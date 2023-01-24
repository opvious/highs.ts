import * as sut from '../src/solver';

describe('solver', () => {
  test('returns unset status', () => {
    const solver = sut.Solver.create();
    expect(solver.getStatus()).toEqual(sut.SolverStatus.NOT_SET);
  });

  test('returns unset info', () => {
    const solver = sut.Solver.create();
    expect(solver.getInfo()).toMatchObject({basis_validity: 0});
  });
});
