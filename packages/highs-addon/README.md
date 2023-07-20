# HiGHS addon [![NPM version](https://img.shields.io/npm/v/highs-addon.svg)](https://www.npmjs.com/package/highs-addon)

Low-level Node.js binding for the [HiGHS optimization solver][highs]. Consider
using [`highs-solver`](/packages/highs-solver) for a more idiomatic TypeScript
API.

## Installation

```sh
npm i highs-addon
```

This package ships with pre-built binaries for several common environments:

| Platform | Architecture | C library |
| --- | --- | --- |
| `darwin` | `x64` | n/a |
| `linux` | `x64` | `glibc` |
| `linux` | `x64` | `musl` |
| `linux` | `arm64` | `glibc` |
| `linux` | `arm64` | `musl` |

If your system doesn't match one of the environments above, a binary will be
built automatically during installation. This requires a toolchain capable of
compiling [HiGHS][highs] and native Node.js addons.

[highs]: https://github.com/ERGO-COde/HiGHS
