const binding = require('pkg-prebuilds')(__dirname, {
  name: 'highs-solver',
  napi_versions: [8],
});

Object.assign(module.exports, binding);
