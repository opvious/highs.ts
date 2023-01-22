export function solverVersion(): string;

export declare class Solver {
  constructor(fp: string);

  // Main API
  passModel(model: Model): void;
  run(cb: (err: Error) => void): void;
  getSolution(): Solution;
  clear(): void;

  // Convenience utilities
  readModel(fp: string): string;
  writeSolution(fp: string): void;

  // TODO:
  // passModel(model: Model): void;
  // getSolution(): Solution;
  // clearModel(): void;
  // clearSolver(): void;
}

export interface Model {
  readonly isMaximization: boolean;
  readonly matrix: SparseMatrix;
  readonly offset: number;
  readonly costs: Float64Array;
  readonly columnLowerBounds: Float64Array;
  readonly columnUpperBounds: Float64Array;
  readonly rowLowerBounds: Float64Array;
  readonly rowUpperBounds: Float64Array;
  readonly integrality: Int32Array;
  readonly hessian?: SparseMatrix;
}

export interface SparseMatrix {
  readonly nonZeroCount: number;
  readonly isColumnOriented: boolean;
  readonly offsets: Int32Array;
  readonly columns: Int32Array;
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
