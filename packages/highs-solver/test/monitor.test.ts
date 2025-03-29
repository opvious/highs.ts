import {waitForEvent} from '@mtth/stl-utils/events';
import {ResourceLoader} from '@mtth/stl-utils/files';

import * as sut from '../src/monitor.js';

const loader = ResourceLoader.enclosing(import.meta.url).scoped('test');

test('parse progress', () => {
  const lines = [
    '         0       0         0   0.00%   0               inf                  inf        0      0      2        57     0.0s', // eslint-disable-line max-len
    ' L       0       0         0 100.00%   0               0                  0.00%     2228     30     80       339     0.2s', // eslint-disable-line max-len
  ] as const;
  expect(sut.parseProgress(lines[0])).toEqual({
    cutCount: 0,
    dualBound: 0,
    lpIterationCount: 57,
    primalBound: Infinity,
    relativeGap: Infinity,
  });
  expect(sut.parseProgress(lines[1])).toEqual({
    cutCount: 2228,
    dualBound: 0,
    lpIterationCount: 339,
    primalBound: 0,
    relativeGap: 0,
  });
});

test('tracker', async () => {
  const events: sut.SolveProgress[] = [];
  const monitor = sut.solveMonitor().on('progress', (p) => events.push(p));
  const tracker = sut.SolveTracker.create({
    monitor,
    logPath: loader.localUrl('queens-15.log').pathname,
    fromBeginning: true,
  });
  await waitForEvent(monitor, 'done');
  tracker.shutdown();
  expect(events).toMatchObject([
    {lpIterationCount: 0},
    {lpIterationCount: 57},
    {lpIterationCount: 339},
    {lpIterationCount: 909},
  ]);
});
