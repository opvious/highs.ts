export function solverVersion(): string;

export declare class Solver {
  constructor(fp: string);

  clear(): void;

  run(cb: (err: Error) => void): void;

  // Convenience utilities
  readModel(fp: string): string;
  writeSolution(fp: string): void;

  // TODO:
  // passModel(model: Model): void;
  // getSolution(): Solution;
  // clearModel(): void;
  // clearSolver(): void;
}

/*
export interface Model {
  readonly colCount: number;
  readonly rowCount: number;
  readonly hessian: number;
  readonly isMaximization: boolean;
  readonly offset: number;
  readonly costs: Float64Array;
  readonly colLower: Float64Array;
  readonly colUpper: Float64Array;
  readonly rowLower: Float64Array;
  readonly rowUpper: Float64Array;
}

export interface SparseMatrix {
  readonly offsets: Int32Array;
  readonly columns: Int32Array;
  readonly values: Float64Array;
}

export interface Solution {
}
*/
