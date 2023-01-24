import {assert, errorFactories} from '@opvious/stl-errors';
import events from 'events';

import {Model, Solution} from './common';
import {SolveMonitor} from './monitor';
import {Solver, SolverOptions, SolverStatus} from './solver';

export * from './common';
export {SolveMonitor, solveMonitor, SolveProgress} from './monitor';
export * from './solver';
export {solverVersion} from 'highs-solver-addon';

const [errors, codes] = errorFactories({
  definitions: {
    solveNotOptimal: (solver: Solver, cause?: unknown) => ({
      message: `Solve ended with status ${SolverStatus[solver.getStatus()]}`,
      tags: {solver},
      cause,
    }),
  },
  prefix: 'ERR_HIGHS_',
});

export const errorCodes = codes;

/**
 * Solves an optimization problem asynchronously. The model can be specified
 * inline or via a file, using any format supported by HiGHS. This method will
 * throw an error if the solution is not optimal.
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
  try {
    await solver.solve({monitor});
  } catch (cause) {
    throw errors.solveNotOptimal(solver, cause);
  }
  if (solver.getStatus() !== SolverStatus.OPTIMAL) {
    throw errors.solveNotOptimal(solver);
  }
  const sol = solver.getSolution();
  assert(sol, 'Missing solution');
  return sol;
}
