import {assert, mergeErrorCodes} from '@opvious/stl-errors';
import events from 'events';

import {commonErrorCodes, Model, Solution} from './common';
import {SolveMonitor} from './monitor';
import {Solver, solverErrorCodes, SolverOptions} from './solver';

export {
  Constraint,
  Model,
  Objective,
  Solution,
  SolutionStatus,
  SolutionValues,
  SparseRow,
  sparseRow,
  Variable,
  VariableType,
} from './common';
export {SolveMonitor, solveMonitor, SolveProgress} from './monitor';
export {Solver, SolverInfo, SolverOptions, SolverStatus} from './solver';
export {solverVersion} from 'highs-solver-addon';

/** All error codes produced by this library. */
export const errorCodes = mergeErrorCodes({
  ...commonErrorCodes,
  ...solverErrorCodes,
});

/**
 * Solves an optimization problem asynchronously. The model can be specified
 * inline or via a file path, using any format supported by HiGHS. This method
 * will throw an error if the solution is not optimal.
 */
export async function solve(
  model: Model | string,
  opts?: SolverOptions
): Promise<Solution>;
export async function solve(
  model: Model | string,
  monitor: SolveMonitor | undefined,
  opts?: SolverOptions
): Promise<Solution>;
export async function solve(
  model: Model | string,
  arg2?: SolveMonitor | SolverOptions,
  arg3?: SolverOptions
): Promise<Solution> {
  let monitor: SolveMonitor | undefined;
  let opts: SolverOptions | undefined;
  if (arg2 instanceof events.EventEmitter || arg3 != null) {
    monitor = arg2 as any;
    opts = arg3;
  } else {
    opts = arg2 as any;
  }

  const solver = Solver.create(opts);
  if (typeof model == 'string') {
    await solver.setModelFromFile(model);
  } else {
    solver.setModel(model);
  }
  await solver.solve({monitor});
  const sol = solver.getSolution();
  assert(sol, 'Missing solution');
  return sol;
}
