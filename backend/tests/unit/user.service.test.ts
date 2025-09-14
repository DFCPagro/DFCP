import * as userService from '../../src/services/user.service';

describe('user.service', () => {
  it('exposes createUser', () => {
    expect(typeof (userService as any).createUser).toBe('function');
  });
});
