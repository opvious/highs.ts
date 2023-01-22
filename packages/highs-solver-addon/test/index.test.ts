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
  test('solves valid MPS file', async () => {
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
