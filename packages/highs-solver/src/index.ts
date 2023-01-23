import {assert, errorFactories} from '@opvious/stl-errors';

import {Model, Solution} from './common';
import {Solver, SolverOptions, SolverStatus} from './solver';

export * from './common';
export * from './solver';
export {solverVersion} from 'highs-solver-addon';

const [errors, codes] = errorFactories({
  definitions: {
    nonOptimalStatus: (s: SolverStatus, solver: Solver) => ({
      message: `Solve ended with non-optimal status ${SolverStatus[s]}`,
      tags: {status: s, solver},
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
): Promise<Solution> {
  const solver = Solver.create(opts);
  if (typeof model == 'string') {
    await solver.setModelFromFile(model);
  } else {
    solver.setModel(model);
  }
  await solver.solve();
  const status = solver.getStatus();
  if (status !== SolverStatus.OPTIMAL) {
    throw errors.nonOptimalStatus(status, solver);
  }
  const sol = solver.getSolution();
  assert(sol, 'Missing solution');
  return sol;
}
