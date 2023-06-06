# HiGHS solver [![NPM version](https://img.shields.io/npm/v/highs-solver.svg)](https://www.npmjs.com/package/highs-solver)

Node.js binding for the [HiGHS optimization solver][highs].

## Features

+ Native solver performance, equivalent to running the C++ HiGHS executable
  directly
+ Non-blocking solves, optionally emitting progress updates (optimality gap,
  LP iterations, ...)
+ Performance boosters: warm start, live objective and constraint updates, ...

## Installation

```sh
npm i highs-solver
```

If your system's architecture doesn't match one of the prebuilt addons, the
addon will be built automatically during installation. This requires a
compatible toolchain, refer to the corresponding [installation steps][addon] for
details.

## Examples

```typescript
import * as highs from 'highs-solver';
```

### Solve LP file

```typescript
const solution = await highs.solve('my-model.lp', {
  options: {time_limit: 30, mip_rel_gap: 0.05, /* ... */},
  style: highs.SolutionStyle.PRETTY,
});
```

All file formats (`.lp`, `.mps`, ...) and [options][highs-options] supported by
HiGHS may be passed in.

### Monitor solving progress

```typescript
const solution = await highs.solve('my-large-model.mps', {
  monitor: highs.solveMonitor().on('progress', (prog) => {
    // Called each time the solver emits a progress notification.
    console.log(prog);
  }),
  // Other options...
});
```

The monitor's `'progress'` event includes information such as optimality gap,
number of LP iterations, ...

### Warm start

```typescript
const solver = highs.Solver.create();
solver.setModel(/* Model instance */); // Or set from file.
solver.warmStart({primalColumns: new Float64Array(/* Starting point */)});
await solver.solve();
const solution = solver.getSolution();
```


[highs]: https://github.com/ERGO-COde/HiGHS
[highs-options]: https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HighsOptions.h
[addon]: /packages/highs-addon
