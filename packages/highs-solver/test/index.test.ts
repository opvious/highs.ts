import {errorCode, fail} from '@opvious/stl-errors';
import path from 'path';

import * as sut from '../src';

describe('solve', () => {
  test('handles inline model', async () => {
    const sol = await sut.solve({
      objective: {
        isMaximization: true,
        weights: sparseRow([0, 1, 2, 3], [1, 2, 4, 1]),
        offset: 10,
      },
      variables: [
        {type: sut.VariableType.CONTINUOUS, lowerBound: 0, upperBound: 40},
        {type: sut.VariableType.CONTINUOUS},
        {type: sut.VariableType.CONTINUOUS},
        {type: sut.VariableType.CONTINUOUS, lowerBound: 2, upperBound: 3},
      ],
      constraints: [
        {weights: sparseRow([0, 1, 2, 3], [-1, 1, 1, 10]), upperBound: 20},
        {weights: sparseRow([0, 1, 2], [1, -4, 1]), upperBound: 30},
        {weights: sparseRow([1, 3], [1, -0.5]), lowerBound: 0, upperBound: 0},
      ],
    });
    expect(sol).toEqual({
      primal: {
        variables: sparseRow([0, 1, 2, 3], [17.5, 1, 16.5, 2]),
        constraints: sparseRow([0, 1], [20, 30]),
      },
      dual: {
        variables: sparseRow([3], [-8.75]),
        constraints: sparseRow([0, 1, 2], [1.5, 2.5, 10.5]),
      },
    });
  });

  test('handles model from file', async () => {
    try {
      await sut.solve(resourcePath('simple.mps'));
      fail();
    } catch (err) {
      expect(errorCode(err)).toEqual(sut.errorCodes.NonOptimalStatus);
    }
  });
});

function resourcePath(name: string): string {
  return path.join(__dirname, 'resources', name);
}

function sparseRow(indices: ReadonlyArray<number>, values: ReadonlyArray<number>): sut.SparseRow {
  return {
    indices: new Int32Array(indices),
    values: new Float64Array(values),
  };
}
