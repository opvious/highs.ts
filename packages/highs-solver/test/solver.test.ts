import {fail} from '@opvious/stl-errors';
import {readFile} from 'fs/promises';
import * as tmp from 'tmp-promise';

import * as sut from '../src/solver';
import {resourcePath} from './helpers';

describe('solver', () => {
  test('returns unset status', () => {
    const solver = sut.Solver.create();
    expect(solver.getStatus()).toEqual(sut.SolverStatus.NOT_SET);
  });

  test('returns unset info', () => {
    const solver = sut.Solver.create();
    expect(solver.getInfo()).toMatchObject({basis_validity: 0});
  });

  test('writes empty solution', async () => {
    const solver = sut.Solver.create();
    await tmp.withFile(async (res) => {
      await solver.writeSolution(res.path);
      const data = await readFile(res.path, 'utf8');
      expect(data).toContain('Not Set');
    });
  });

  test('writes empty model', async () => {
    const solver = sut.Solver.create();
    await tmp.withFile(
      async (res) => {
        await solver.writeModel(res.path);
        const data = await readFile(res.path, 'utf8');
        expect(data).toContain('min');
      },
      {postfix: '.lp'}
    );
  });

  test('solves unbounded problem', async () => {
    const solver = sut.Solver.create();
    await solver.setModelFromFile(resourcePath('unbounded.mps'));
    try {
      await solver.solve();
      fail();
    } catch (err) {
      expect(err).toMatchObject({
        code: sut.solverErrorCodes.SolveNonOptimal,
        tags: {status: sut.SolverStatus.UNBOUNDED},
      });
    }
  });

  test('allows non-optimal statuses', async () => {
    const solver = sut.Solver.create();
    await solver.setModelFromFile(resourcePath('unbounded.mps'));
    await solver.solve({allowNonOptimal: true});
    expect(solver.getStatus()).toEqual(sut.SolverStatus.UNBOUNDED);
  });
});
