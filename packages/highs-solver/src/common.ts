import {assert} from '@opvious/stl-errors';

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L162
export enum SolverStatus {
  NOT_SET = 0,
  LOAD_ERROR,
  MODEL_ERROR,
  PRESOLVE_ERROR,
  SOLVE_ERROR,
  POSTSOLVE_ERROR,
  MODEL_EMPTY,
  OPTIMAL,
  INFEASIBLE,
  UNBOUNDED_OR_INFEASIBLE,
  UNBOUNDED,
  OBJECTIVE_BOUND,
  OBJECTIVE_TARGET,
  TIME_LIMIT,
  ITERATION_LIMIT,
  UNKNOWN,
  SOLUTION_LIMIT,
}

export function asSolverStatus(num: number): SolverStatus {
  assert(SolverStatus[num], 'Invalid status: %s', num);
  return num as SolverStatus;
}

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L87
export enum VariableType {
  CONTINUOUS = 0,
  INTEGER,
  SEMI_CONTINUOUS,
  SEMI_INTEGER,
  IMPLICIT_INTEGER,
}

export enum SolutionStatus {
  NO_SOLUTION = 0,
  INFEASIBLE,
  FEASIBLE,
}
