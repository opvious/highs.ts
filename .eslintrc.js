module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  plugins: [
    '@opvious',
  ],
  extends: [
    'plugin:@opvious/typescript',
  ],
  ignorePatterns: [
    '/build/',
    '/deps/',
  ],
};
