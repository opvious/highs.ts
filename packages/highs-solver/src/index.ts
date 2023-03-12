import {assert, mergeErrorCodes} from '@opvious/stl-errors';
import {MarkPresent} from '@opvious/stl-utils';
import {readFile} from 'fs/promises';
import * as tmp from 'tmp-promise';

import {commonErrorCodes, Model, Solution, SolutionStyle} from './common';
import {SolveMonitor} from './monitor';
import {Solver, SolverCreationOptions,solverErrorCodes} from './solver';

export {
  Constraint,
  Model,
  Objective,
  Solution,
  SolutionStatus,
  SolutionStyle,
  SolutionValues,
  SparseRow,
  sparseRow,
  Variable,
  VariableType,
} from './common';
export {SolveMonitor, solveMonitor, SolveProgress} from './monitor';
export {
  Solver,
  SolverCreationOptions,
  SolverInfo,
  SolverOptions,
  SolverStatus,
} from './solver';
export {solverVersion} from 'highs-addon';

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
  opts?: SolveOptions
): Promise<Solution>;
export async function solve(
  model: Model | string,
  opts: MarkPresent<SolveOptions, 'style'>
): Promise<string>;
export async function solve(
  model: Model | string,
  opts?: SolveOptions
): Promise<Solution | string> {
  const solver = Solver.create(opts?.options);
  if (typeof model == 'string') {
    await solver.setModelFromFile(model);
  } else {
    solver.setModel(model);
  }
  await solver.solve({monitor: opts?.monitor});
  if (opts?.style != null) {
    return intoFile((fp) => solver.writeSolution(fp, opts?.style));
  }
  const sol = solver.getSolution();
  assert(sol, 'Missing solution');
  return sol;
}

/** Solving options. */
export interface SolveOptions {
  /** Listening hooks for solver events. */
  readonly monitor?: SolveMonitor;

  /** Underlying solver creation options. */
  readonly options?: SolverCreationOptions;

  /**
   * Solution formatting style. If omitted, the solution will be returned in
   * its in-memory format.
   */
  readonly style?: SolutionStyle;
}

function intoFile(fn: (fp: string) => Promise<void>): Promise<string> {
  return tmp.withFile(async (res) => {
    await fn(res.path);
    return readFile(res.path, 'utf8');
  });
}
