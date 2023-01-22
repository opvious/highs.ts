export function solverVersion(): string;

export declare class Solver {
  constructor(fp: string);

  passModel(model: Model): void;
  readModel(fp: string, cb: (err: Error) => void): string;

  run(cb: (err: Error) => void): void;

  getSolution(): Solution;
  writeSolution(fp: string, cb: (err: Error) => void): void;

  clear(): void;

  // TODO:
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

/** Row-oriented sparse representation. */
export interface SparseMatrix {
  readonly columnCount: number;
  readonly rowStarts: Int32Array;
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
