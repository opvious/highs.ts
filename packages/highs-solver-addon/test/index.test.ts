import {readFile} from 'fs/promises';
import path from 'path';
import {withFile} from 'tmp-promise';
import {AsyncOrSync} from 'ts-essentials';
import util from 'util';

import * as sut from '../';

test('vendor version', () => {
  expect(sut.solverVersion()).toMatch(/v.+/);
});

describe('solver', () => {
  test('gets an empty solution', async () => {
    await withSolver(async (solver) => {
      const sol = solver.getSolution();
      expect(sol).toMatchObject({
        isValid: false,
        isDualValid: false,
      });
    });
  });

  test('solves a valid LP file', async () => {
    await withSolver(async (solver) => {
      solver.readModel(resourcePath('simple.lp'));
      const run = util.promisify(solver.run).bind(solver);
      await run();
      const sol = solver.getSolution();
      expect(cloneSolution(sol)).toEqual({
        isValid: true,
        isDualValid: true,
        columnValues: new Float64Array([17.5, 1, 16.5, 2]),
        columnDualValues: new Float64Array([-0, -0, -0, -8.75]),
        rowValues: new Float64Array([20, 30, 0]),
        rowDualValues: new Float64Array([1.5, 2.5, 10.5]),
      });
    });
  });

  test('solves a valid MPS file', async () => {
    await withSolver(async (solver) => {
      solver.readModel(resourcePath('unbounded.mps'));
      const run = util.promisify(solver.run).bind(solver);
      await run();
      await withFile(async (res) => {
        solver.writeSolution(res.path);
        const sol = await readFile(res.path, 'utf8');
        expect(sol).toContain('Unbounded');
      });
    });
  });

  test('throws on missing file', async () => {
    await withSolver(async (solver) => {
      try {
        solver.readModel(resourcePath('missing.mps'));
        fail();
      } catch (err) {
        expect(err.message).toMatch(/could not be read/);
      }
    });
  });
});

function cloneSolution(sol: sut.Solution): sut.Solution {
  return {
    ...sol,
    columnValues: new Float64Array(sol.columnValues),
    columnDualValues: new Float64Array(sol.columnDualValues),
    rowValues: new Float64Array(sol.rowValues),
    rowDualValues: new Float64Array(sol.rowDualValues),
  };
}

function withSolver(
  fn: (solver: sut.Solver) => AsyncOrSync<void>
): Promise<void> {
  return withFile(async (res) => {
    await fn(new sut.Solver(res.path));
  });
}

function resourcePath(fn: string): string {
  return path.join(__dirname, 'resources', fn);
}

function fail(): void {
  throw new Error('Unexpected call');
}
