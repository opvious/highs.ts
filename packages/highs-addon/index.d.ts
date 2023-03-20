/** Returns the underlying optimization solver's version. */
export function solverVersion(): string;

// https://github.com/ERGO-Code/HiGHS/blob/master/src/Highs.h
export declare class Solver {
  // First signature to enable better auto-complete.
  setOption<N extends keyof CommonOptions>(
    name: N,
    val: CommonOptions[N]
  ): void;
  setOption<N extends string>(
    name: N,
    val: N extends keyof CommonOptions ? CommonOptions[N] : OptionValue
  ): void;
  getOption<N extends keyof CommonOptions>(name: N): CommonOptions[N];
  getOption<N extends string>(
    name: N
  ): N extends keyof CommonOptions ? CommonOptions[N] : OptionValue;

  passModel(model: Model): void;
  readModel(fp: string, cb: (err: Error) => void): string;
  writeModel(fp: string, cb: (err: Error) => void): string;

  run(cb: (err: Error) => void): void;
  getModelStatus(): ModelStatus;
  getInfo(): Info;

  getSolution(): Solution;
  writeSolution(
    fp: string,
    style: SolutionStyle,
    cb: (err: Error) => void
  ): void;

  clear(): void;
  clearModel(): void;
  clearSolver(): void;
}

export type OptionValue = boolean | number | string;

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HighsOptions.h
export interface CommonOptions {
  readonly presolve?: 'on' | 'off' | 'choose'; // kPresolveString
  readonly solver?: 'simplex' | 'choose' | 'ipm'; // kSolverString
  readonly parallel?: 'on' | 'off' | 'choose'; // kParallelString
  readonly run_crossover?: 'on' | 'off' | 'choose'; // kRunCrossoverString
  readonly time_limit?: number; // kTimeLimitString
  readonly ranging?: 'on' | 'off'; // kRangingString
  readonly infinite_cost?: number;
  readonly infinite_bound?: number;
  readonly small_matrix_value?: number;
  readonly large_matrix_value?: number;
  readonly primal_feasibility_tolerance?: number;
  readonly dual_feasibility_tolerance?: number;
  readonly ipm_feasibility_tolerance?: number;
  readonly objective_bound?: number;
  readonly objective_target?: number;
  readonly random_seed?: number; // kRandomSeed
  readonly threads?: number;
  readonly output_flag?: boolean;
  readonly log_file?: string; // kLogFileString
  readonly log_to_console?: boolean;
  readonly mip_abs_gap?: number;
  readonly mip_rel_gap?: number;
}

export interface Model {
  /** Number of variables. */
  readonly columnCount: number;

  /**
   * Integrality of variables, values must be one of `ColumnType`'s. Can
   * (should) be omitted if all variables are continuous.
   */
  readonly columnTypes?: Int32Array;

  /**
   * Variable bounds. Both arrays must have the same length, equal to the
   * number of variables.
   */
  readonly columnLowerBounds: Float64Array;
  readonly columnUpperBounds: Float64Array;

  /** Number of constraints. */
  readonly rowCount: number;

  /**
   * Constraint bounds. Both arrays must have the same length, equal to the
   * number of constraints.
   */
  readonly rowLowerBounds: Float64Array;
  readonly rowUpperBounds: Float64Array;

  /** Row-oriented weight matrix. */
  readonly weights: Matrix;

  /** Objective sense. */
  readonly isMaximization: boolean;

  /** Objective offset. */
  readonly objectiveOffset?: number;

  /** Objective weights. */
  readonly objectiveLinearWeights: Float64Array;

  /**
   * Only top-right half (assuming row-wise) entries need be present. The matrix
   * will be assumed symmetric and entries in the lower-left half will be
   * ignored. Note also that the effective objective weight for diagonal entries
   * is 1/2 of their value in this matrix.
   */
  readonly objectiveQuadraticWeights?: Matrix;
}

export interface Matrix {
  readonly offsets: Int32Array;
  readonly indices: Int32Array;
  readonly values: Float64Array;
}

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HStruct.h#L30
export interface Solution {
  readonly isValueValid: boolean;
  readonly isDualValid: boolean;
  readonly columnValues: Float64Array;
  readonly columnDualValues: Float64Array;
  readonly rowValues: Float64Array;
  readonly rowDualValues: Float64Array;
}

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HighsInfo.h#L152
export interface Info {
  readonly basis_validity: number;
  readonly simplex_iteration_count: number;
  readonly ipm_iteration_count: number;
  readonly qp_iteration_count: number;
  readonly objective_function_value: number;
  readonly mip_gap: number;
  readonly mip_dual_bound: number;
  readonly mip_node_count: number;
  readonly [name: string]: number;
}

// Enums placeholders (not included here since this is a declaration file only)

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L87
// 0 = continuous, 1 = integer, ...
export type ColumnType = number;

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L162
export type ModelStatus = number;

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L112
// 0 = no solution, 1 = infeasible, 2 = feasible
export type SolutionStatus = number;

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L127
export type SolutionStyle = number;
