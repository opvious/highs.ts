import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

export const packageInfo = require(join(__dirname, '..', 'package.json'));

// enum class HighsVarType
// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L96
export enum ColumnType {
  CONTINUOUS = 0,
  INTEGER,
  SEMI_CONTINUOUS,
  SEMI_INTEGER,
  IMPLICIT_INTEGER,
}

// enum SolutionStatus
// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L131
export enum SolutionStatus {
  NO_SOLUTION = 0,
  INFEASIBLE,
  FEASIBLE,
}

// enum SolutionStyle
// https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HConst.h#L146
export enum SolutionStyle {
  RAW = 0,
  PRETTY,
  GLPSOL_RAW,
  GLPSOL_PRETTY,
  SPARSE,
}
