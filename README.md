# HiGHS for Node.js [![CI](https://github.com/opvious/highs.ts/actions/workflows/ci.yml/badge.svg)](https://github.com/opvious/highs.ts/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/opvious/highs.ts/branch/main/graph/badge.svg?token=yZatY8V1oT)](https://codecov.io/gh/opvious/highs.ts)

Native Node.js bindings for the [HiGHS optimization solver][highs].

```typescript
import * as highs from 'highs-solver';

// Solves an LP model, outputting regular progress updates (gap, ...).
const solution = await highs.solve('model.lp', {
  monitor: highs.solveMonitor().on('progress', console.log),
  options: {time_limit: 600, mip_rel_gap: 0.05},
  style: highs.SolutionStyle.PRETTY,
});
```

## Packages

The following packages are available:

+ [`highs-solver`](/packages/highs-solver), high-level idiomatic TypeScript API
+ [`highs-addon`](/packages/highs-addon), low-level API mirroring
  the underlying C++ solver

## Related projects

+ https://github.com/ERGO-Code/HiGHS, the underlying C++ HiGHS optimization
  solver
+ https://github.com/lovasoa/highs-js, WebAssembly solver port

[highs]: https://github.com/ERGO-COde/HiGHS
