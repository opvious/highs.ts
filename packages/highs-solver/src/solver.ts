import {assert} from '@opvious/stl-errors';
import {ifPresent} from '@opvious/stl-utils';
import * as addon from 'highs-solver-addon';
import util from 'util';

import {Constraint, Model, Solution, SparseRow, Variable} from './common';

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
    assert(!this.solving, 'Solve in progress');
    for (const [name, val] of Object.entries(opts)) {
      if (val != null) {
        this.delegate.setOption(name, val);
      }
    }
  }

  setModel(model: Model): void {
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
   * Sets the solved model from a file stored on disk. Any format accepted by
   * HiGHS is permissible (e.g. `.lp,` `.mps`).
   */
  async setModelFromFile(fp: string): Promise<void> {
    assert(!this.solving, 'Solve in progress');
    return this.promisified('readModel', fp);
  }

  /**
   * Runs the solver using the current options. No mutating operations may be
   * performed on the solver until the returned promise is resolved (i.e. the
   * solve ends).
   */
  async solve(): Promise<void> {
    this.solving = true;
    try {
      return await this.promisified('run');
    } finally {
      this.solving = false;
    }
  }

  isSolving(): boolean {
    return this.solving;
  }

  getStatus(): SolverStatus {
    return asSolverStatus(this.delegate.getModelStatus());
  }

  getSolution(): Solution | undefined {
    const sol = this.delegate.getSolution();
    if (!sol.isValueValid) {
      return undefined;
    }
    return {
      primal: {
        variables: sparsifyRow(sol.columnValues),
        constraints: sparsifyRow(sol.rowValues),
      },
      dual: sol.isDualValid
        ? {
            variables: sparsifyRow(sol.columnDualValues),
            constraints: sparsifyRow(sol.rowDualValues),
          }
        : undefined,
    };
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
}

function assertBalanced(row: SparseRow): void {
  const {indices, values} = row;
  assert(
    indices.length === values.length,
    'Mismatched row: len(%o) != len(%o)',
    indices,
    values
  );
}

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

function sparsifyRow(arr: Float64Array): SparseRow {
  let size = 0;
  for (const val of arr) {
    if (val !== 0) {
      size++;
    }
  }
  const indices = new Int32Array(size);
  const values = new Float64Array(size);
  let ix = 0;
  for (const [vix, val] of arr.entries()) {
    if (val !== 0) {
      indices[ix] = vix;
      values[ix] = val;
      ix++;
    }
  }
  return {indices, values};
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
