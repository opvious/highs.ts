/** Progress tracking. */

import {assert, check} from '@opvious/stl-errors';
import {TypedEmitter, typedEmitter} from '@opvious/stl-utils/events';
import {Tail} from 'tail';

const iterationHeaderPattern = /^\s*Proc\. InQueue.*$/;
const iterationDataPattern =
  // eslint-disable-next-line max-len
  /^\s+\w?\s+\d+\s+\d+\s+\d+\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\d+\s+\d+\s+(\d+)\s+\S+\s*$/;
const reportHeaderPattern = /^Solving report$/;

export interface SolveListeners {
  readonly progress: (prog: SolveProgress) => void;
}

export interface SolveProgress {
  readonly relativeGap: number;
  readonly primalBound: number;
  readonly dualBound: number;
  readonly cutCount: number;
  readonly lpIterationCount: number;
}

export type SolveMonitor = TypedEmitter<SolveListeners>;

export function solveMonitor(): SolveMonitor {
  return typedEmitter<SolveListeners>();
}

export class SolveTracker {
  private state: ProgressState = ProgressState.PREPARATION;
  constructor(
    private readonly monitor: SolveMonitor,
    private readonly tail: Tail
  ) {
    tail.on('line', (line) => {
      this.ingest(line);
    });
  }

  static create(args: {
    readonly monitor: SolveMonitor;
    readonly logPath: string;
  }): SolveTracker {
    return new SolveTracker(args.monitor, new Tail(args.logPath));
  }

  shutdown(): void {
    this.tail.unwatch();
  }

  private ingest(line: string): void {
    if (iterationHeaderPattern.test(line)) {
      this.state = ProgressState.ITERATION;
    } else if (reportHeaderPattern.test(line)) {
      this.state = ProgressState.REPORT;
    } else {
      switch (this.state) {
        case ProgressState.ITERATION: {
          const match = iterationDataPattern.exec(line);
          if (match) {
            assert(match.length === 6, 'Bad match', match);
            this.monitor.emit('progress', {
              relativeGap: parseNumber(check.isPresent(match[3])),
              primalBound: parseNumber(check.isPresent(match[2])),
              dualBound: parseNumber(check.isPresent(match[1])),
              cutCount: +check.isPresent(match[4]),
              lpIterationCount: +check.isPresent(match[5]),
            });
          }
          break;
        }
        default:
      }
    }
  }
}

enum ProgressState {
  PREPARATION,
  ITERATION,
  REPORT,
}

function parseNumber(arg: string): number {
  return arg === 'inf'
    ? Infinity
    : arg.endsWith('%')
    ? +arg.slice(0, -1) / 100
    : +arg;
}
