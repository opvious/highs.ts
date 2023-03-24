/**
 * Convenience script to call `solve` on a file and output the solution in
 * pretty format.
 *
 * Usage: `node model.mjs MODEL_PATH`
 */

import * as highs from '../lib/index.js';

async function main() {
  const model = process.argv[2];
  if (!model) {
    throw new Error('Missing model path');
  }
  const solution = await highs.solve(model, {
    style: highs.SolutionStyle.PRETTY,
  });
  console.log(solution);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
