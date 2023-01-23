# HiGHS solver [![CI](https://github.com/opvious/highs-solver/actions/workflows/ci.yml/badge.svg)](https://github.com/opvious/highs-solver/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/opvious/highs-solver/branch/main/graph/badge.svg?token=yZatY8V1oT)](https://codecov.io/gh/opvious/highs-solver)

Native Node.js bindings for the [HiGHS optimization solver][highs].

## Packages

The following packages are available:

+ [`highs-solver`](/packages/highs-solver), high-level idiomatic TypeScript API
+ [`highs-solver-addon`](/packages/highs-solver-addon), low-level API mirroring
  the underlying C++ solver

## Related projects

+ https://github.com/ERGO-Code/HiGHS, the underlying C++ HiGHS optimization
  solver
+ https://github.com/lovasoa/highs-js, WebAssembly solver port

[highs]: https://github.com/ERGO-COde/HiGHS
