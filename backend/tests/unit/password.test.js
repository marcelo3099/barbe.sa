const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('password', () => {
  it('gera hash bcrypt diferente da senha e compara corretamente', async () => {
    const hash = await hashPassword('senha1234');
    expect(hash).not.toBe('senha1234');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await comparePassword('senha1234', hash)).toBe(true);
    expect(await comparePassword('outra-senha', hash)).toBe(false);
  });
});
