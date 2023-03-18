import {errorCode, fail} from '@opvious/stl-errors';

import * as sut from '../src';
import {resourcePath} from './helpers';

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

  test('handles unbounded model from file', async () => {
    try {
      await sut.solve(resourcePath('unbounded.mps'));
      fail();
    } catch (err) {
      expect(errorCode(err)).toEqual(sut.errorCodes.SolveNonOptimal);
    }
  });

  test('monitors progress', async () => {
    let progressed = false;
    const monitor = sut.solveMonitor().on('progress', () => {
      progressed = true;
    });
    await sut.solve(resourcePath('queens-15.lp'), {monitor});
    expect(progressed).toBe(true);
  });

  test('outputs styled solution', async () => {
    const sol = await sut.solve(resourcePath('queens-15.lp'), {
      style: sut.SolutionStyle.PRETTY,
    });
    expect(sol).toContain('V222');
  });
});

function jsonify(arg: unknown): unknown {
  return JSON.parse(JSON.stringify(arg));
}
