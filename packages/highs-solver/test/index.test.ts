import {errorCode, fail} from '@opvious/stl-errors';
import path from 'path';

import * as sut from '../src';

describe('solve', () => {
  test('handles inline model', async () => {
    const sol = await sut.solve({
      objective: {
        isMaximization: true,
        weights: sut.sparseRow([1, 2, 4, 1]),
        offset: 10,
      },
      variables: [
        {type: sut.VariableType.CONTINUOUS, lowerBound: 0, upperBound: 40},
        {type: sut.VariableType.CONTINUOUS},
        {type: sut.VariableType.CONTINUOUS},
        {type: sut.VariableType.CONTINUOUS, lowerBound: 2, upperBound: 3},
      ],
      constraints: [
        {weights: sut.sparseRow([-1, 1, 1, 10]), upperBound: 20},
        {weights: sut.sparseRow([1, -4, 1]), upperBound: 30},
        {
          weights: sut.sparseRow([1, -0.5], [1, 3]),
          lowerBound: 0,
          upperBound: 0,
        },
      ],
    });
    expect(sol).toEqual({
      primal: {
        variables: sut.sparseRow([17.5, 1, 16.5, 2]),
        constraints: sut.sparseRow([20, 30]),
      },
      dual: {
        variables: sut.sparseRow([-8.75], [3]),
        constraints: sut.sparseRow([1.5, 2.5, 10.5]),
      },
    });
  });

  test('handles unbounded model from file', async () => {
    try {
      await sut.solve(resourcePath('unbounded.mps'));
      fail();
    } catch (err) {
      expect(errorCode(err)).toEqual(sut.errorCodes.SolveNotOptimal);
    }
  });

  test('monitors progress', async () => {
    let progressed = false;
    const monitor = sut.solveMonitor().on('progress', () => {
      progressed = true;
    });
    await sut.solve(resourcePath('queens-15.lp'), monitor);
    expect(progressed).toBe(true);
  });
});

function resourcePath(name: string): string {
  return path.join(__dirname, 'resources', name);
}
