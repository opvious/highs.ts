/** Solve progress tracking */

import {assert, check} from '@mtth/stl-errors';
import {TypedEmitter, typedEmitter} from '@mtth/stl-utils/events';
import {resolvable} from '@mtth/stl-utils/functions';
import {Tail} from 'tail';

const iterationHeaderPattern = /^\s*.*Proc\. InQueue.*$/;
const iterationDataPattern =
  /^\s+(\w\s+)?\d+\s+\d+\s+\d+\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\d+\s+\d+\s+(\d+)\s+\S+\s*$/;
const reportHeaderPattern = /^Solving report$/;

/** Active solve events */
export interface SolveListeners {
  readonly progress: (prog: SolveProgress) => void;
}

/** Active solve progress notifications */
export interface SolveProgress {
  readonly relativeGap: number;
  readonly primalBound: number;
  readonly dualBound: number;
  readonly cutCount: number;
  readonly lpIterationCount: number;
}

/** Typed event-emitter of solve progress events */
export type SolveMonitor = TypedEmitter<SolveListeners>;

/** Creates a new solve monitor */
export function solveMonitor(): SolveMonitor {
  return typedEmitter<SolveListeners>();
}

export class SolveTracker {
  private state: ProgressState = ProgressState.PREPARATION;
  constructor(
    private readonly monitor: SolveMonitor,
    private readonly done: Promise<void>,
    private readonly setDone: () => void
  ) {}

  static create(args: {
    readonly monitor: SolveMonitor;
    readonly logPath: string;
    readonly fromBeginning?: boolean;
  }): SolveTracker {
    const tail = new Tail(args.logPath, {fromBeginning: args.fromBeginning});
    const [done, setDone] = resolvable(() => void tail.unwatch());
    const tracker = new SolveTracker(args.monitor, done, setDone);
    const onLine = (line: string) => void tracker.ingest(line);
    tail.on('line', onLine);
    return tracker;
  }

  shutdown(): void {
    this.setDone();
  }

  wait(): Promise<void> {
    return this.done;
  }

  private ingest(line: string): void {
    if (iterationHeaderPattern.test(line)) {
      this.state = ProgressState.ITERATION;
    } else if (reportHeaderPattern.test(line)) {
      this.state = ProgressState.REPORT;
      this.setDone();
    } else {
      switch (this.state) {
        case ProgressState.ITERATION: {
          const progress = parseProgress(line);
          if (progress) {
            this.monitor.emit('progress', progress);
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

export function parseProgress(line: string): SolveProgress | undefined {
  const match = iterationDataPattern.exec(line);
  if (!match) {
    return undefined;
  }
  assert(match.length === 7, 'Bad match', match);
  return {
    relativeGap: parseNumber(check.isPresent(match[4])),
    primalBound: parseNumber(check.isPresent(match[3])),
    dualBound: parseNumber(check.isPresent(match[2])),
    cutCount: +check.isPresent(match[5]),
    lpIterationCount: +check.isPresent(match[6]),
  };
}
