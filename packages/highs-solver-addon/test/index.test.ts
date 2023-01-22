import {readFile} from 'fs/promises';
import path from 'path';
import {withFile} from 'tmp-promise';
import {AsyncOrSync} from 'ts-essentials';

import * as sut from '../';

test('vendor version', () => {
  expect(sut.solverVersion()).toMatch(/v.+/);
});

describe('solver', () => {
  test('instantiate', async () => {
    await withSolver(async (solver) => {
      solver.readModel(resourcePath('simple.mps'));
      solver.run();
      await withFile(async (res) => {
        solver.writeSolution(res.path);
        const sol = await readFile(res.path, 'utf8');
        expect(sol).toContain('Unbounded');
      });
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
