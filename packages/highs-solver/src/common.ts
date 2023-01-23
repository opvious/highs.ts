
export enum SolutionStatus {
  NO_SOLUTION = 0,
  INFEASIBLE,
  FEASIBLE,
}

export interface Model {
  readonly objective?: Objective;
  readonly variables: ReadonlyArray<Variable>;
  readonly constraints: ReadonlyArray<Constraint>;
}

export interface Objective {
  readonly isMaximization: boolean;
  readonly weights: SparseRow;
  readonly offset?: number;
}

export interface Variable {
  /** Defaults to false. */
  readonly type: VariableType;

  /** Defaults to -infinity. */
  readonly lowerBound?: number;

  /** Defaults to +infinity. */
  readonly upperBound?: number;
}

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L87
export enum VariableType {
  CONTINUOUS = 0,
  INTEGER,
  SEMI_CONTINUOUS,
  SEMI_INTEGER,
  IMPLICIT_INTEGER,
}

export interface Constraint {
  readonly weights: SparseRow;

  /** Defaults to -infinity. */
  readonly lowerBound?: number;

  /** Defaults to +infinity. */
  readonly upperBound?: number;
}

export interface SparseRow {
  readonly indices: Int32Array;
  readonly values: Float64Array;
}

export interface Solution {
  readonly primal: SolutionValues;
  readonly dual?: SolutionValues;
}

export interface SolutionValues {
  readonly variables: SparseRow;
  readonly constraints: SparseRow;
}
