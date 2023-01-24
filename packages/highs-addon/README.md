# HiGHS solver addon [![NPM version](https://img.shields.io/npm/v/highs-addon.svg)](https://www.npmjs.com/package/highs-addon)

Low-level Node.js binding for the [HiGHS optimization solver][highs]. Consider
using [`highs-solver`](/packages/highs-solver) for a more idiomatic TypeScript
API.

## Installation

```sh
npm i highs-addon
```

If your system's architecture doesn't match one of the prebuilt addons, the
addon will be built automatically during installation. This requires a toolchain
capable of compiling [HiGHS][highs] and native Node.js addons.

[highs]: https://github.com/ERGO-COde/HiGHS
