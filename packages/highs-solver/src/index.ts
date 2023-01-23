import {assert, errorFactories} from '@opvious/stl-errors';

import {Model, Solution} from './common';
import {Solver, SolverOptions, SolverStatus} from './solver';

export * from './common';
export * from './solver';

const [errors, codes] = errorFactories({
  definitions: {
    nonOptimalStatus: (s: SolverStatus) => ({
      message: `Solve ended with non-optimal status ${SolverStatus[s]}`,
      tags: {status: s},
    }),
  },
  prefix: 'ERR_HIGHS_',
});

export const errorCodes = codes;

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
    throw errors.nonOptimalStatus(status);
  }
  const sol = solver.getSolution();
  assert(sol, 'Missing solution');
  return sol;
}
