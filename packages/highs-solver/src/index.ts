import {assert} from '@opvious/stl-errors';
import {PathLike} from '@opvious/stl-utils/files';
import {MarkPresent} from '@opvious/stl-utils/objects';
import {readFile} from 'fs/promises';
import * as tmp from 'tmp-promise';

import {SolutionStyle} from './common.js';
import {SolveMonitor} from './monitor.js';
import {
  Solver,
  SolverCreationOptions,
  SolverModel,
  SolverSolution,
} from './solver.js';

export {ColumnType, SolutionStatus, SolutionStyle} from './common.js';
export {SolveMonitor, solveMonitor, SolveProgress} from './monitor.js';
export {
  Solver,
  SolverCreationOptions,
  SolverInfo,
  SolverModel,
  SolverOptions,
  SolverSolution,
  SolverSolutionValues,
  SolverStatus,
} from './solver.js';
export {Matrix, OptionValue, solverVersion} from 'highs-addon';

/**
 * Solves an optimization problem asynchronously. The model can be specified
 * inline or via a file path, using any format supported by HiGHS. This method
 * will throw an error if the solution is not optimal.
 */
export async function solve(
  model: SolverModel | PathLike,
  opts?: SolveOptions
): Promise<SolverSolution>;
export async function solve(
  model: SolverModel | PathLike,
  opts: MarkPresent<SolveOptions, 'style'>
): Promise<string>;
export async function solve(
  model: SolverModel | PathLike,
  opts?: SolveOptions
): Promise<SolverSolution | string> {
  const solver = Solver.create(opts?.options);
  if (typeof model == 'string' || model instanceof URL) {
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
