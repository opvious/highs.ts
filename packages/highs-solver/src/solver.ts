import {
  assert,
  assertType,
  errorFactories,
  errorMessage,
} from '@mtth/stl-errors';
import {noopTelemetry, Telemetry} from '@mtth/stl-telemetry';
import {localPath, PathLike} from '@mtth/stl-utils/files';
import {ifPresent} from '@mtth/stl-utils/functions';
import {writeFile} from 'fs/promises';
import addon from 'highs-addon';
import * as tmp from 'tmp-promise';
import util from 'util';

import {packageInfo, SolutionStyle} from './common.js';
import {SolveMonitor, SolveTracker} from './monitor.js';

/** Symbol used as key to store the active server in error tags. */
export const solverErrorTag = Symbol('solver');

const [errors, errorCodes] = errorFactories({
  definitions: {
    invalidWarmStart: 'The solution used to warm-start the model was invalid',
    nativeMethodFailed: (method: string, cause: unknown) => ({
      message:
        `Native method '${method}' failed (message: ${errorMessage(cause)}). ` +
        'Check solver logs for more information.',
      tags: {method},
      cause,
    }),
    solveFailed: (solver: Solver, status: SolverStatus, cause?: unknown) => ({
      message: `Solve failed with status ${SolverStatus[status]}`,
      tags: {[solverErrorTag]: solver, status},
      cause,
    }),
    solveInProgress: 'No mutations may be performed while a solve is running',
    solveNonOptimal: (
      solver: Solver,
      status: SolverStatus,
      cause?: unknown
    ) => ({
      message: 'Solve ended with non-optimal status ' + SolverStatus[status],
      tags: {[solverErrorTag]: solver, status},
      cause,
    }),
  },
  prefix: 'ERR_HIGHS_',
});

export {errorCodes};

/** Higher level wrapping class around the HiGHS addon. */
export class Solver {
  private solving = false;
  private constructor(
    private readonly delegate: addon.Solver,
    private readonly telemetry: Telemetry
  ) {}

  /**
   * Creates a new solver. Console logging (`log_to_console` option) is disabled
   * by default.
   */
  static create(opts?: SolverCreationOptions): Solver {
    const tel = opts?.telemetry?.via(packageInfo) ?? noopTelemetry();
    const solver = new Solver(new addon.Solver(), tel);
    solver.updateOptions({log_to_console: false, ...opts?.options});
    return solver;
  }

  /** Merges options with existing ones. */
  updateOptions(opts: SolverOptions): void {
    this.assertNotSolving();
    for (const [name, val] of Object.entries(opts)) {
      if (val != null) {
        this.delegated('setOption', name, val);
      }
    }
  }

  /**
   * Retrieves an option's current value. This method will throw if the name
   * does not match a valid option.
   */
  getOption<N extends keyof addon.TypedOptions>(name: N): addon.TypedOptions[N];
  getOption(name: string): addon.OptionValue;
  getOption(name: string): addon.OptionValue {
    return this.delegated('getOption', name);
  }

  /** Sets the model to be solved. */
  setModel(model: SolverModel): void {
    this.assertNotSolving();
    this.telemetry.logger.debug('Setting inline model.');

    const width = model.columnLowerBounds.length;
    const height = model.rowLowerBounds.length;
    assert(
      model.columnUpperBounds.length === width &&
        (model.columnTypes?.length ?? width) === width &&
        (model.objectiveLinearWeights?.length ?? width) === width &&
        (model.objectiveQuadraticWeights?.offsets.length ?? width) === width,
      'Inconsistent width'
    );
    assert(
      model.rowUpperBounds.length === height &&
        model.weights.offsets.length <= height,
      'Inconsistent height'
    );

    const {
      objectiveLinearWeights: lweights,
      objectiveQuadraticWeights: qweights,
      ...rest
    } = model;
    let hessian: addon.Matrix | undefined;
    if (qweights) {
      // We multiply diagonal values by 2 to keep effective objective weight
      // equal to the input weight.
      const {offsets, indices, values} = qweights;
      const scaledValues = values.slice();
      for (const [row, ix0] of offsets.entries()) {
        const ix1 = offsets[row + 1] ?? indices.length;
        for (let ix = ix0; ix < ix1; ix++) {
          const col = indices[ix]!;
          // TODO: Binary search.
          if (col === row) {
            scaledValues[ix] = values[ix]! * 2;
          } else if (col > row) {
            break;
          }
        }
      }
      hessian = {offsets, indices, values: scaledValues};
    }

    this.delegated('passModel', {
      columnCount: width,
      rowCount: height,
      objectiveLinearWeights: lweights ?? new Float64Array(width),
      objectiveHessian: hessian,
      ...rest,
    });
  }

  /**
   * Sets the model to be solved from a file stored on disk. Any format accepted
   * by HiGHS is permissible (e.g. `.lp,` `.mps`).
   */
  async setModelFromFile(pl: PathLike): Promise<void> {
    this.assertNotSolving();
    const {telemetry: tel} = this;
    tel.logger.debug('Setting model from %j...', pl);
    await tel.withActiveSpan({name: 'HiGHS read model file'}, () =>
      this.delegatedPromise('readModel', localPath(pl))
    );
  }

  /**
   * Write the current model. The file path must end in one HiGHS' supported
   * extensions (`.lp`, `.mps`, ...).
   */
  async writeModel(pl: PathLike): Promise<void> {
    const {telemetry: tel} = this;
    tel.logger.debug('Wring model to %j...', pl);
    await tel.withActiveSpan({name: 'HiGHS write model'}, () =>
      this.delegatedPromise('writeModel', localPath(pl))
    );
  }

  /**
   * Updates the model's objective, keeping everything else as-is. Any fields
   * undefined in the input will be left unchanged.
   */
  updateObjective(args: {
    readonly isMaximization?: boolean;
    readonly offset?: number;

    /**
     * New model linear costs. If present, must have length equal to the model's
     * number of variables.
     */
    readonly linearWeights?: Float64Array;
  }): void {
    this.assertNotSolving();
    this.telemetry.logger.debug('Updating objective.');

    ifPresent(
      args.isMaximization,
      (s) => void this.delegated('changeObjectiveSense', s)
    );
    ifPresent(
      args.offset,
      (o) => void this.delegated('changeObjectiveOffset', o)
    );
    ifPresent(
      args.linearWeights,
      (c) => void this.delegated('changeColsCost', c)
    );
  }

  /** Adds constraint rows to the loaded model. */
  addRows(args: {
    readonly weights: addon.Matrix;
    readonly lowerBounds: Float64Array;
    readonly upperBounds: Float64Array;
  }): void {
    this.assertNotSolving();
    this.telemetry.logger.debug('Adding rows.');

    const {weights, lowerBounds: lbs, upperBounds: ubs} = args;
    const height = weights.offsets.length;
    assert(
      lbs.length === height && ubs.length === height,
      'Inconsistent height'
    );
    assert(
      weights.indices.length === weights.values.length,
      'Inconsistent width'
    );

    this.delegated('addRows', height, lbs, ubs, weights);
  }

  /**
   * Warm-starts the solver with a solution. By default this method will also
   * check that the solution is valid and throw an illegal warm-start error if
   * not.
   */
  warmStart(args: {
    /** New primal solution values. */
    readonly primalColumns: Float64Array;

    /** Optional dual values. */
    readonly dualRows?: Float64Array;

    /** Do not check that the solution is valid. */
    readonly allowInvalid?: boolean;
  }): void {
    this.assertNotSolving();
    this.telemetry.logger.debug('Adding warm-start solution.');

    this.delegated('setSolution', {
      columnValues: args.primalColumns,
      rowDualValues: args.dualRows,
    });
    if (!args.allowInvalid) {
      const {isValid} = this.delegated('assessPrimalSolution');
      if (!isValid) {
        throw errors.invalidWarmStart();
      }
    }
  }

  /**
   * Runs the solver on the last set model using the current options. No
   * mutating operations may be performed on the solver until the returned
   * promise is resolved (i.e. the solve ends).
   *
   * By default this method will throw if the solver did not find an optimal
   * solution. See the `allowNonOptimal` option to change this behavior.
   */
  async solve(opts?: {
    /** Solver status event consumer. */
    readonly monitor?: SolveMonitor;
    /** Do not throw if the underlying solver exited with non-OPTIMAL status. */
    readonly allowNonOptimal?: boolean;
    /** If true, the solver will not reset all clocks before solving. */
    readonly keepClocks?: boolean;
  }): Promise<void> {
    this.assertNotSolving();
    const {telemetry: tel} = this;
    tel.logger.debug('Starting solve...');

    if (!opts?.keepClocks) {
      this.delegated('zeroAllClocks');
    }

    let logPath = this.delegated('getOption', 'log_file');
    assertType('string', logPath);

    let tempLog: tmp.FileResult | undefined;
    let tracker: SolveTracker | undefined;
    if (opts?.monitor) {
      if (!logPath) {
        // We need the logs to track progress.
        tempLog = await tmp.file();
        logPath = tempLog.path;
        this.delegated('setOption', 'log_file', logPath);
      }
      // Make sure the file exists to we can tail it.
      await writeFile(logPath, '', {flag: 'a'});
      tracker = SolveTracker.create({logPath, monitor: opts.monitor});
    }

    this.solving = true;
    let err: unknown | undefined;
    let status: SolverStatus | undefined;
    await tel.withActiveSpan({name: 'HiGHS solve'}, async (span) => {
      try {
        await this.delegatedPromise('run');
      } catch (cause) {
        err = cause;
      }

      this.solving = false;
      tracker?.shutdown();
      if (tempLog) {
        this.delegated('setOption', 'log_file', '');
        await tempLog.cleanup();
      }

      status = this.getStatus();
      span.setAttribute('solver.status', SolverStatus[status]);
      switch (status) {
        case SolverStatus.OPTIMAL:
        case SolverStatus.INFEASIBLE:
        case SolverStatus.ITERATION_LIMIT:
        case SolverStatus.OBJECTIVE_BOUND:
        case SolverStatus.OBJECTIVE_TARGET:
        case SolverStatus.SOLUTION_LIMIT:
        case SolverStatus.TIME_LIMIT:
        case SolverStatus.UNBOUNDED:
        case SolverStatus.UNBOUNDED_OR_INFEASIBLE:
          break; // Do not throw here
        default:
          throw errors.solveFailed(this, status, err);
      }
    });
    assert(status != null, 'Missing status');

    tel.logger.info('Solve ended with status %s.', SolverStatus[status]);
    if (!opts?.allowNonOptimal && status !== SolverStatus.OPTIMAL) {
      throw errors.solveNonOptimal(this, status, err);
    }
  }

  /** Returns true if the solver is currently solving the model. */
  isSolving(): boolean {
    return this.solving;
  }

  /** Returns the cumulative wall-clock time spent in the last solve. */
  getRunTime(): number {
    return this.delegated('getRunTime');
  }

  /** Reset all internal solver clocks to zero. */
  zeroAllClocks(): void {
    this.delegated('zeroAllClocks');
  }

  /** Returns the current solver status, set from the last solve. */
  getStatus(): SolverStatus {
    return asSolverStatus(this.delegated('getModelStatus'));
  }

  /** Returns the current solver info, set from the last solve. */
  getInfo(): SolverInfo {
    return this.delegated('getInfo');
  }

  /** Returns the current solution, set from the last solve. */
  getSolution(): SolverSolution | undefined {
    const sol = this.delegated('getSolution');
    if (!sol.isValueValid) {
      return undefined;
    }
    const info = this.delegated('getInfo');
    return {
      objectiveValue: info.objective_function_value,
      relativeGap: info.mip_node_count >= 0 ? info.mip_gap : undefined,
      primal: {rows: sol.rowValues, columns: sol.columnValues},
      dual: sol.isDualValid
        ? {rows: sol.rowDualValues, columns: sol.columnDualValues}
        : undefined,
    };
  }

  /** Write the current solution to the given path. */
  async writeSolution(
    pl: PathLike,
    style?: addon.SolutionStyle
  ): Promise<void> {
    this.assertNotSolving();
    const {telemetry: tel} = this;
    tel.logger.debug('Writing solution to %j...', pl);
    await tel.withActiveSpan({name: 'HiGHS write solution'}, () =>
      this.delegatedPromise(
        'writeSolution',
        localPath(pl),
        style ?? SolutionStyle.RAW
      )
    );
  }

  private delegated<M extends keyof addon.Solver>(
    method: M,
    ...args: addon.Solver[M] extends (...args: infer A) => any
      ? A extends [...any, (err: Error) => void]
        ? never
        : A
      : never
  ): addon.Solver[M] extends (...args: any) => infer R ? R : never {
    const {delegate} = this;
    try {
      return (delegate[method] as Function).bind(delegate)(...args);
    } catch (cause) {
      throw errors.nativeMethodFailed(method, cause);
    }
  }

  private async delegatedPromise<M extends keyof addon.Solver>(
    method: M,
    ...args: addon.Solver[M] extends (
      ...args: [...infer A, (err: Error) => void]
    ) => void
      ? A
      : never
  ): Promise<void> {
    const {delegate} = this;
    try {
      return await util.promisify(delegate[method]).bind(delegate)(...args);
    } catch (cause) {
      throw errors.nativeMethodFailed(method, cause);
    }
  }

  private assertNotSolving(): void {
    if (this.solving) {
      throw errors.solveInProgress();
    }
  }

  [util.inspect.custom](): string {
    return `<Solver HiGHS ${addon.solverVersion()}>`;
  }
}

export interface SolverCreationOptions {
  /**
   * Initial options for the underlying solver. These can be updated later via
   * the `updateOptions` method.
   */
  readonly options?: SolverOptions;

  /** Solver telemetry instance, defaults to a no-op implementation. */
  readonly telemetry?: Telemetry;
}

export type SolverInfo = addon.Info;

export type SolverModel = Omit<
  addon.Model,
  'columnCount' | 'rowCount' | 'objectiveLinearWeights' | 'objectiveHessian'
> & {
  /** Can be omitted if all-zero. */
  readonly objectiveLinearWeights?: Float64Array;

  /**
   * Only top-right half (assuming row-wise) entries need be present. The matrix
   * will be assumed symmetric and entries in the lower-left half will be
   * ignored.
   */
  readonly objectiveQuadraticWeights?: addon.Matrix;
};

export interface SolverSolution {
  readonly objectiveValue: number;
  readonly relativeGap?: number;
  readonly primal: SolverSolutionValues;
  readonly dual?: SolverSolutionValues;
}

export interface SolverSolutionValues {
  readonly rows: Float64Array;
  readonly columns: Float64Array;
}

export interface SolverOptions extends Partial<addon.TypedOptions> {
  readonly [name: string]: addon.OptionValue | undefined;
}

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L162
export enum SolverStatus {
  NOT_SET = 0,
  LOAD_ERROR,
  MODEL_ERROR,
  PRESOLVE_ERROR,
  SOLVE_ERROR,
  POSTSOLVE_ERROR,
  MODEL_EMPTY,
  OPTIMAL,
  INFEASIBLE,
  UNBOUNDED_OR_INFEASIBLE,
  UNBOUNDED,
  OBJECTIVE_BOUND,
  OBJECTIVE_TARGET,
  TIME_LIMIT,
  ITERATION_LIMIT,
  UNKNOWN,
  SOLUTION_LIMIT,
}

function asSolverStatus(num: number): SolverStatus {
  assert(SolverStatus[num] != null, 'Invalid status: %s', num);
  return num as SolverStatus;
}
