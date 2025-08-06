import {errorCode, fail} from '@mtth/stl-errors';
import {ResourceLoader} from '@mtth/stl-utils/files';

import errorCodes from '../src/index.errors.js';
import * as sut from '../src/index.js';

const loader = ResourceLoader.enclosing(import.meta.url).scoped('test');

describe('solve', () => {
  test('handles inline model', async () => {
    const sol = await sut.solve({
      isMaximization: true,
      objectiveOffset: 10,
      objectiveLinearWeights: new Float64Array([1, 2, 4, 1]),
      columnTypes: new Int32Array(4),
      columnLowerBounds: new Float64Array([0, -Infinity, -Infinity, 2]),
      columnUpperBounds: new Float64Array([40, Infinity, Infinity, 3]),
      rowLowerBounds: new Float64Array([-Infinity, -Infinity, 0]),
      rowUpperBounds: new Float64Array([20, 30, 0]),
      weights: {
        offsets: new Int32Array([0, 4, 7]),
        indices: new Int32Array([0, 1, 2, 3, 0, 1, 2, 1, 3]),
        values: new Float64Array([-1, 1, 1, 10, 1, -4, 1, 1, -0.5]),
      },
    });
    expect(jsonify(sol)).toEqual(
      jsonify({
        objectiveValue: 97.5,
        primal: {
          columns: new Float64Array([17.5, 1, 16.5, 2]),
          rows: new Float64Array([20, 30, 0]),
        },
        dual: {
          columns: new Float64Array([0, 0, 0, -8.75]),
          rows: new Float64Array([1.5, 2.5, 10.5]),
        },
      })
    );
  });

  test('handles inline quadratic model', async () => {
    const sol = await sut.solve({
      isMaximization: false,
      objectiveLinearWeights: new Float64Array(2),
      objectiveQuadraticWeights: {
        offsets: new Int32Array([0, 2]),
        indices: new Int32Array([0, 1, 1]),
        values: new Float64Array([0.5, -0.5, 0.5]),
      },
      columnLowerBounds: new Float64Array(2),
      columnUpperBounds: new Float64Array([1, 1]),
      rowLowerBounds: new Float64Array([1]),
      rowUpperBounds: new Float64Array([1]),
      weights: {
        offsets: new Int32Array([0]),
        indices: new Int32Array([0, 1]),
        values: new Float64Array([1, 1]),
      },
    });
    expect(sol).toMatchObject({
      objectiveValue: 0.125,
      primal: {columns: {0: 0.5, 1: 0.5}, rows: {0: 1}},
    });
  });

  test('handles sample quadratic model', async () => {
    const sol = await sut.solve({
      isMaximization: false,
      objectiveLinearWeights: new Float64Array(3),
      objectiveQuadraticWeights: {
        offsets: new Int32Array([0, 2, 3]),
        indices: new Int32Array([1, 2, 2]),
        values: new Float64Array([0.5, -0.75, -0.25]),
      },
      columnLowerBounds: new Float64Array(3),
      columnUpperBounds: new Float64Array([1, 1, 1]),
      rowLowerBounds: new Float64Array([10, -Infinity]),
      rowUpperBounds: new Float64Array([Infinity, 1]),
      weights: {
        offsets: new Int32Array([0, 3]),
        indices: new Int32Array([0, 1, 2, 0, 1, 2]),
        values: new Float64Array([8, 3, 12, 1, 1, 1]),
      },
    });
    expect(sol.objectiveValue).toBeCloseTo(-0.1875);
  });

  test('handles unbounded model from file', async () => {
    try {
      await sut.solve(loader.localUrl('unbounded.mps'));
      fail();
    } catch (err) {
      expect(errorCode(err)).toEqual(errorCodes.SolveNonOptimal);
    }
  });

  test('checks solver get run time', async () => {
    const solver = sut.Solver.create();
    await solver.setModelFromFile(loader.localUrl('unbounded.mps'));
    expect(solver.getRunTime()).toEqual(0);
    await solver.solve({allowNonOptimal: true});
    expect(solver.getRunTime()).toBeGreaterThan(0);
  });

  test('zero all solver clocks manually', async () => {
    const solver = sut.Solver.create();
    await solver.setModelFromFile(loader.localUrl('unbounded.mps'));
    expect(solver.getRunTime()).toEqual(0);
    await solver.solve({allowNonOptimal: true, keepClocks: true});
    expect(solver.getRunTime()).toBeGreaterThan(0);
    solver.zeroAllClocks();
    expect(solver.getRunTime()).toEqual(0);
  });

  test('monitors progress', async () => {
    let progressed = false;
    const monitor = sut.solveMonitor().on('progress', () => {
      progressed = true;
    });
    await sut.solve(loader.localUrl('queens-15.lp'), {monitor});
    expect(progressed).toBe(true);
  });

  test('outputs styled solution', async () => {
    const sol = await sut.solve(loader.localUrl('queens-15.lp'), {
      style: sut.SolutionStyle.PRETTY,
    });
    expect(sol).toContain('V222');
  });

  test('solves QP from LP file', async () => {
    const sol = await sut.solve(loader.localUrl('quadratic.lp'));
    const cols = sol.primal.columns;
    expect(cols[0]).toBeCloseTo(-4);
    expect(cols[1]).toBeCloseTo(5);
  });
});

function jsonify(arg: unknown): unknown {
  return JSON.parse(JSON.stringify(arg));
}
