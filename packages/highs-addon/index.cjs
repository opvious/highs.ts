const binding = require('pkg-prebuilds')(
  __dirname,
  require('./binding-options')
);

Object.assign(module.exports, binding);
