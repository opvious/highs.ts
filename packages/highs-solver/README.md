# HiGHS solver

Node.js binding for the [HiGHS optimization solver][highs].

## Features

+ Native solver performance
+ Asynchronous type-safe API

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

### Solve from LP file

```typescript
const solution = await highs.solve('my-model.lp');
```

All file formats (`.lp`, `.mps`, ...) supported by HiGHS may be passed in as
well.

### Solve inline model

```typescript
const solution = await highs.solve({
  objective: {
    isMaximization: true,
    weights: highs.sparseRow([1, 2, 4, 1]),
    offset: 10,
  },
  variables: [
    {type: highs.VariableType.CONTINUOUS, lowerBound: 0, upperBound: 40},
    {type: highs.VariableType.CONTINUOUS},
    {type: highs.VariableType.CONTINUOUS},
    {type: highs.VariableType.CONTINUOUS, lowerBound: 2, upperBound: 3},
  ],
  constraints: [
    {weights: highs.sparseRow([-1, 1, 1, 10]), upperBound: 20},
    {weights: highs.sparseRow([1, -4, 1]), upperBound: 30},
    {weights: highs.sparseRow([1, -0.5], [1, 3]), lowerBound: 0, upperBound: 0},
  ],
});
```

### Customize solver options

```typescript
const solution = await highs.solve('my-model.lp', {
  time_limit: 30,
  mip_rel_gap: 0.05,
  // ...
});
```

All [options][highs-options] supported by HiGHS may be specified.

### Monitor solving progress

```typescript
const solution = await solver.solve(
  'my-large-model.mps',
  highs.solveMonitor().on('progress', (prog) => {
    // Called each time the solver emits a progress notification.
    console.log(prog);
  })
);
```

This will output statistics including optimality gap, number of LP iterations,
...

[highs]: https://github.com/ERGO-COde/HiGHS
[highs-options]: https://github.com/ERGO-Code/HiGHS/blob/master/src/lp_data/HighsOptions.h
[addon]: /packages/highs-solver-addon
