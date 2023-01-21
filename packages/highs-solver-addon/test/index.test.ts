import * as sut from '../';

test('vendor version', () => {
  expect(sut.vendorVersion()).toMatch(/v.+/);
});
