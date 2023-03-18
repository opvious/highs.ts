import {enclosingPackageInfo} from '@opvious/stl-telemetry';

export const packageInfo = enclosingPackageInfo(__dirname);

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L87
export enum ColumnType {
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

// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L127
export enum SolutionStyle {
  RAW = 0,
  PRETTY,
  GLPSOL_RAW,
  GLPSOL_PRETTY,
  SPARSE,
}
