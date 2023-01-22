import {assert, errorFactories} from '@opvious/stl-errors';
import * as addon from 'highs-solver-addon';
import util from 'util';

import {asSolverStatus, SolverStatus} from './common';

const [errors] = errorFactories({
  definitions: {
    infeasible: 'Model is infeasible',
    unbounded: 'Model is unbounded',
  },
  prefix: 'ERR_HIGHS_',
});

export {VariableType} from 'highs-solver-addon';

export interface SolverOptions extends addon.CommonOptions {
  readonly [name: string]: addon.OptionValue | undefined;
}

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
    return undefined; // TODO.
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

export async function solve(
  model: Model | string,
  opts?: SolverOptions
): Promise<Solution> {
  const solver = Solver.create(opts);
  if (typeof model == 'string') {
    await solver.setModelFromFile(model);
  } else {
    // TODO.
  }
  await solver.solve();
  throw errors.infeasible(); // TODO.
}

export interface Model {
  readonly objective?: Objective;
  readonly variables: ReadonlyArray<Variable>;
  readonly constraints: ReadonlyArray<Constraint>;
}

export interface Objective {
  readonly isMaximization: boolean;
  readonly linearWeights?: SparseRow;
  readonly quadraticWeights?: SparseMatrix;
  readonly offset?: number;
}

export interface Variable {
  /** Defaults to false. */
  readonly type?: addon.VariableType;

  /** Defaults to -infinity. */
  readonly lowerBound?: number;

  /** Defaults to +infinity. */
  readonly upperBound?: number;
}

export interface Constraint {
  readonly weights: SparseRow;

  /** Defaults to -infinity. */
  readonly lowerBound?: number;

  /** Defaults to +infinity. */
  readonly upperBound?: number;
}

export interface SparseRow {
  readonly indices: ReadonlyArray<number>;
  readonly values: ReadonlyArray<number>;
}

export interface SparseMatrix {
  readonly rowIndices: ReadonlyArray<number>;
  readonly columnIndices: ReadonlyArray<number>;
  readonly values: ReadonlyArray<number>;
}

export interface Solution {
  readonly variableValues: SparseRow;
  readonly constraintValues: SparseRow;
  readonly dualVariableValues: SparseRow;
  readonly dualConstraintValues: SparseRow;
}
