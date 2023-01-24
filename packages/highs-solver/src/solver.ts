import {assert, errorFactories} from '@opvious/stl-errors';
import {ifPresent} from '@opvious/stl-utils';
import {writeFile} from 'fs/promises';
import * as addon from 'highs-addon';
import * as tmp from 'tmp-promise';
import util from 'util';

import {
  assertBalanced,
  Constraint,
  Model,
  Solution,
  SolutionStyle,
  SparseRow,
  sparseRow,
  Variable,
} from './common';
import {SolveMonitor, SolveTracker} from './monitor';

const [errors, codes] = errorFactories({
  definitions: {
    solveInProgress: 'No mutations may be performed while a solve is running',
    solveNotOptimal: (solver: Solver, cause?: unknown) => ({
      message: `Solve ended with status ${SolverStatus[solver.getStatus()]}`,
      tags: {
        solution: solver.getSolution(),
        solver,
        status: solver.getStatus(),
      },
      cause,
    }),
  },
  prefix: 'ERR_HIGHS_',
});

export const solverErrorCodes = codes;

export class Solver {
  private solving = false;
  private constructor(private readonly delegate: addon.Solver) {}

  /** Creates a new solver. Console logging is disabled by default. */
  static create(opts?: SolverOptions): Solver {
    const solver = new Solver(new addon.Solver());
    solver.updateOptions({...opts, log_to_console: false});
    return solver;
  }

  /** Merges options with existing ones. */
  updateOptions(opts: SolverOptions): void {
    this.assertNotSolving();
    for (const [name, val] of Object.entries(opts)) {
      if (val != null) {
        this.delegate.setOption(name, val);
      }
    }
  }

  /** Sets the model to be solved. */
  setModel(model: Model): void {
    this.assertNotSolving();
    const {objective: obj, constraints, variables} = model;
    const width = variables.length;
    this.delegate.passModel({
      columnCount: width,
      rowCount: constraints.length,
      isMaximization: obj?.isMaximization ?? false,
      offset: obj?.offset ?? 0,
      costs:
        ifPresent(obj?.weights, (w) => densifyRow(w, width)) ??
        new Float64Array(width),
      matrix: computeMatrix(constraints),
      columnLowerBounds: densify(variables, (v) => v.lowerBound ?? -Infinity),
      columnUpperBounds: densify(variables, (v) => v.upperBound ?? Infinity),
      rowLowerBounds: densify(constraints, (v) => v.lowerBound ?? -Infinity),
      rowUpperBounds: densify(constraints, (v) => v.upperBound ?? Infinity),
      integrality: computeIntegrality(variables),
    });
  }

  /**
   * Sets the model to be solved from a file stored on disk. Any format accepted
   * by HiGHS is permissible (e.g. `.lp,` `.mps`).
   */
  async setModelFromFile(fp: string): Promise<void> {
    this.assertNotSolving();
    return this.promisified('readModel', fp);
  }

  /**
   * Runs the solver on the last set model using the current options. No
   * mutating operations may be performed on the solver until the returned
   * promise is resolved (i.e. the solve ends).
   *
   * This method will throw if the solver did not find an optimal solution.
   */
  async solve(opts?: {readonly monitor?: SolveMonitor}): Promise<void> {
    this.assertNotSolving();

    let logPath = this.delegate.getOption('log_file');
    let tempLog: tmp.FileResult | undefined;
    let tracker: SolveTracker | undefined;
    if (opts?.monitor) {
      if (!logPath) {
        // We need the logs to track progress.
        tempLog = await tmp.file();
        logPath = tempLog.path;
        this.delegate.setOption('log_file', logPath);
      }
      // Make sure the file exists to we can tail it.
      await writeFile(logPath, '', {flag: 'a'});
      tracker = SolveTracker.create({logPath, monitor: opts.monitor});
    }

    this.solving = true;
    try {
      await this.promisified('run');
    } catch (cause) {
      throw errors.solveNotOptimal(this, cause);
    } finally {
      tracker?.shutdown();
      if (tempLog) {
        this.delegate.setOption('log_file', '');
        await tempLog.cleanup();
      }
      this.solving = false;
    }
    if (this.getStatus() !== SolverStatus.OPTIMAL) {
      throw errors.solveNotOptimal(this);
    }
  }

  /** Returns true if the solver is currently solving the model. */
  isSolving(): boolean {
    return this.solving;
  }

  /** Returns the current solver status, set from the last solve. */
  getStatus(): SolverStatus {
    return asSolverStatus(this.delegate.getModelStatus());
  }

  /** Returns the current solver info, set from the last solve. */
  getInfo(): SolverInfo {
    return this.delegate.getInfo();
  }

  /** Returns the current solution, set from the last solve. */
  getSolution(): Solution | undefined {
    const sol = this.delegate.getSolution();
    if (!sol.isValueValid) {
      return undefined;
    }
    return {
      primal: {
        variables: sparseRow(sol.columnValues),
        constraints: sparseRow(sol.rowValues),
      },
      dual: sol.isDualValid
        ? {
            variables: sparseRow(sol.columnDualValues),
            constraints: sparseRow(sol.rowDualValues),
          }
        : undefined,
    };
  }

  /** Write the current solution to the given path. */
  async writeSolution(fp: string, style?: SolutionStyle): Promise<void> {
    this.assertNotSolving();
    await this.promisified('writeSolution', fp, style ?? SolutionStyle.RAW);
  }

  private promisified<M extends keyof addon.Solver>(
    method: M,
    ...args: addon.Solver[M] extends (
      ...args: [...infer A, (err: Error) => void]
    ) => void
      ? A
      : never
  ): Promise<void> {
    const {delegate} = this;
    return util.promisify(delegate[method]).bind(delegate)(...args);
  }

  private assertNotSolving(): void {
    if (this.solving) {
      throw errors.solveInProgress();
    }
  }
}

export type SolverInfo = addon.Info;

function densifyRow(row: SparseRow, size: number): Float64Array {
  const arr = new Float64Array(size);
  const {indices, values} = row;
  assertBalanced(row);
  for (const [ix, vix] of indices.entries()) {
    arr[vix] = values[ix]!;
  }
  return arr;
}

function computeMatrix(
  constraints: ReadonlyArray<Constraint>
): addon.SparseMatrix {
  let weightCount = 0;
  for (const {weights} of constraints) {
    assertBalanced(weights);
    weightCount += weights.indices.length;
  }
  const starts = new Int32Array(constraints.length);
  const indices = new Int32Array(weightCount);
  const values = new Float64Array(weightCount);
  let wix = 0;
  for (const [rix, {weights: w}] of constraints.entries()) {
    starts[rix] = wix;
    indices.set(w.indices, wix);
    values.set(w.values, wix);
    wix += w.indices.length;
  }
  return {isColumnOriented: false, starts, indices, values};
}

function densify<V>(
  gen: ReadonlyArray<V>,
  fn: (val: V) => number
): Float64Array {
  const arr = new Float64Array(gen.length);
  for (const [ix, val] of gen.entries()) {
    arr[ix] = fn(val);
  }
  return arr;
}

function computeIntegrality(vars: ReadonlyArray<Variable>): Int32Array {
  const arr = new Int32Array(vars.length);
  for (const [ix, v] of vars.entries()) {
    arr[ix] = +v.type;
  }
  return arr;
}

export interface SolverOptions extends addon.CommonOptions {
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
  assert(SolverStatus[num], 'Invalid status: %s', num);
  return num as SolverStatus;
}
