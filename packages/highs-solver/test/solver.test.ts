import {fail} from '@opvious/stl-errors';
import {ResourceLoader} from '@opvious/stl-utils/files';
import {readFile} from 'fs/promises';
import * as tmp from 'tmp-promise';

import errorCodes from '../src/index.errors.js';
import * as sut from '../src/solver.js';

const loader = ResourceLoader.enclosing(import.meta.url).scoped('test');

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

  test('writes QP to LP format', async () => {
    const want = await readFile(loader.localUrl('quadratic.lp'), 'utf8');
    const solver = sut.Solver.create();
    await tmp.withFile(
      async (res) => {
        solver.setModel({
          isMaximization: false,
          objectiveOffset: 26,
          objectiveLinearWeights: new Float64Array([-2, -12]),
          objectiveQuadraticWeights: {
            offsets: new Int32Array([0, 2]),
            indices: new Int32Array([0, 1, 1]),
            values: new Float64Array([1, 2, 2]),
          },
          columnLowerBounds: new Float64Array([-10, -10]),
          columnUpperBounds: new Float64Array([10, 10]),
          rowLowerBounds: new Float64Array(0),
          rowUpperBounds: new Float64Array(0),
          weights: {
            offsets: new Int32Array(0),
            indices: new Int32Array(0),
            values: new Float64Array(0),
          },
        });
        await solver.writeModel(res.path);
        const got = await readFile(res.path, 'utf8');
        expect(got).toContain(want);
      },
      {postfix: '.lp'}
    );
  });

  test('solves unbounded problem', async () => {
    const solver = sut.Solver.create();
    await solver.setModelFromFile(loader.localUrl('unbounded.mps'));
    try {
      await solver.solve();
      fail();
    } catch (err) {
      expect(err).toMatchObject({
        code: errorCodes.SolveNonOptimal,
        tags: {status: sut.SolverStatus.UNBOUNDED},
      });
    }
  });

  test('allows non-optimal statuses', async () => {
    const solver = sut.Solver.create();
    await solver.setModelFromFile(loader.localUrl('unbounded.mps'));
    await solver.solve({allowNonOptimal: true});
    expect(solver.getStatus()).toEqual(sut.SolverStatus.UNBOUNDED);
  });

  test('wraps native method errors', () => {
    const solver = sut.Solver.create();
    try {
      solver.updateOptions({unknown_option: 123});
      fail();
    } catch (err) {
      expect(err).toMatchObject({
        code: errorCodes.NativeMethodFailed,
      });
    }
  });
});
