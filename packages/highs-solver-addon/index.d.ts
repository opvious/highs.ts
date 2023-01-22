export function solverVersion(): string;

export declare class Solver {
  // First signature to enable better auto-complete.
  setOption<N extends keyof CommonOptions>(
    name: N,
    val: SolverOptions[N]
  ): void;
  setOption<N extends string>(
    name: N,
    val: N extends keyof CommonOptions ? SolverOptions[N] : OptionValue
  ): void;

  passModel(model: Model): void;
  readModel(fp: string, cb: (err: Error) => void): string;

  run(cb: (err: Error) => void): void;

  getSolution(): Solution;
  writeSolution(fp: string, cb: (err: Error) => void): void;

  clear(): void;
  clearModel(): void;
  clearSolver(): void;

  // TODO:
  // setSolution(sol: Solution): void;
  // addRows(matrix: SparseMatrix, bounds: Bounds): void;
}

export type OptionValue = boolean | number | string;

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
}

export interface Model {
  /** Number of variables. */
  readonly columnCount: number;

  /** Number of constraints. */
  readonly rowCount: number;

  /** Data matrix. */
  readonly matrix: SparseMatrix;

  /** Objective sense. */
  readonly isMaximization: boolean;

  /** Objective offset. */
  readonly offset: number;

  /** Objective weights. */
  readonly costs: Float64Array;

  /** Variable bounds. */
  readonly columnLowerBounds: Float64Array;
  readonly columnUpperBounds: Float64Array;

  /** Constraint bounds. */
  readonly rowLowerBounds: Float64Array;
  readonly rowUpperBounds: Float64Array;

  /** Indices of integer variables. */
  readonly integrality: Int32Array;

  /** Must be column oriented if present. */
  readonly hessian?: SparseMatrix;
}

/** Sparse matric representation. */
export interface SparseMatrix {
  readonly isColumnOriented: boolean;
  readonly starts: Int32Array;
  readonly indices: Int32Array;
  readonly values: Float64Array;
}

export interface Solution {
  readonly isValid: boolean;
  readonly isDualValid: boolean;
  readonly columnValues: Float64Array;
  readonly columnDualValues: Float64Array;
  readonly rowValues: Float64Array;
  readonly rowDualValues: Float64Array;
}
