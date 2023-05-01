import * as path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'c8',
      reportsDirectory: 'out/coverage',
    },
    globalSetup: [
      path.join(__dirname, 'packages/highs-addon/resources/vitest-setup.cjs'),
    ],
  },
});
