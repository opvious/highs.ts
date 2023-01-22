import * as addon from 'highs-solver-addon';
import util from 'util';

export interface SolverOptions extends addon.CommonOptions {
  readonly [name: string]: addon.OptionValue | undefined;
}

export class Solver {
  private constructor(private readonly delegate: addon.Solver) {}

  static create(opts?: SolverOptions): Solver {
    const solver = new Solver(new addon.Solver());
    solver.setOptions({...opts, log_to_console: false});
    return solver;
  }

  setOptions(opts: SolverOptions): void {
    for (const [name, val] of Object.entries(opts)) {
      if (val != null) {
        this.delegate.setOption(name, val);
      }
    }
  }

  setModelFromFile(fp: string): Promise<void> {
    return this.promisified('readModel', fp);
  }

  solve(): Promise<void> {
    return this.promisified('run');
  }

  getSolution(): Solution {
    return this.delegate.getSolution();
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
  return solver.getSolution();
}

export interface Model {
  readonly objective?: Objective;
  readonly variables: ReadonlyArray<Variable>;
  readonly constraints: ReadonlyArray<Constraint>;
}

export interface Objective {
  readonly isMaximization: boolean;
  readonly costs?: SparseRow;
  readonly hessian?: SparseMatrix;
  readonly offset?: number;
}

export interface Variable {}

export interface Constraint {}

export interface SparseRow {}

export interface SparseMatrix {}

export interface Solution {}
