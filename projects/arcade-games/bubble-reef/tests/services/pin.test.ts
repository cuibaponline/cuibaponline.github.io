import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  constantTimeEqual,
  generateRecoveryCode,
  hashSecret,
  isTrivialPin,
  normalizeRecoveryCode,
  verifySecret,
} from '../../src/services/pin';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hashSecret', () => {
  it('produces a hash that verifySecret accepts', async () => {
    const { hash, salt } = await hashSecret('4829');
    await expect(verifySecret('4829', hash, salt)).resolves.toBe(true);
  });

  it('salts randomly, so the same PIN stores differently each time', async () => {
    const a = await hashSecret('4829');
    const b = await hashSecret('4829');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('uses a 16-byte salt and a 32-byte hash, as hex', async () => {
    const { hash, salt } = await hashSecret('4829');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never stores the secret itself', async () => {
    const { hash, salt } = await hashSecret('4829');
    expect(hash + salt).not.toContain('4829'.repeat(4));
  });
});

describe('verifySecret', () => {
  it('matches a known PBKDF2-SHA256 answer at 100,000 iterations', async () => {
    // Computed separately with Node's pbkdf2Sync and Python's hashlib.pbkdf2_hmac, which agree.
    const salt = '000102030405060708090a0b0c0d0e0f';
    const hash = '627e88716126e1b1d18fa05efafa8dc3802aa7b07384908f5247aa34f13626d0';
    await expect(verifySecret('4829', hash, salt)).resolves.toBe(true);
  });

  it('accepts the right secret', async () => {
    const { hash, salt } = await hashSecret('4829');
    await expect(verifySecret('4829', hash, salt)).resolves.toBe(true);
  });

  it('rejects the wrong secret', async () => {
    const { hash, salt } = await hashSecret('4829');
    await expect(verifySecret('4828', hash, salt)).resolves.toBe(false);
  });

  it('rejects when the salt does not match', async () => {
    const a = await hashSecret('4829');
    const b = await hashSecret('4829');
    await expect(verifySecret('4829', a.hash, b.salt)).resolves.toBe(false);
  });

  it.each([
    ['empty hash and salt', '', ''],
    ['empty hash', '', '00112233445566778899aabbccddeeff'],
    ['empty salt', 'abcd', ''],
    ['non-hex salt', 'abcd', 'zzzz'],
    ['odd-length salt', 'abcd', 'abc'],
  ])('returns false rather than throwing for %s', async (_label, hash, salt) => {
    await expect(verifySecret('4829', hash, salt)).resolves.toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it.each([
    ['abcd', 'abcd', true],
    ['', '', true],
    ['abcd', 'xbcd', false],
    ['abcd', 'abcx', false],
    ['abcd', 'abc', false],
    ['abc', 'abcd', false],
    ['abcd', '', false],
    ['a\0', 'a', false],
  ])('compares %j and %j as %s', (a, b, want) => {
    expect(constantTimeEqual(a, b)).toBe(want);
  });

  it('keeps comparing after the first difference', () => {
    const b = 'xbcd';
    const charCodeAt = vi.spyOn(String.prototype, 'charCodeAt');
    constantTimeEqual('abcd', b);
    const positions = charCodeAt.mock.calls.map(([index]) => index);
    expect(new Set(positions)).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe('isTrivialPin', () => {
  it.each([
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  ])('rejects the repeated digit %s', (pin) => {
    expect(isTrivialPin(pin)).toBe(true);
  });

  it.each(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '7890', '8901', '9012'])(
    'rejects the ascending run %s',
    (pin) => {
      expect(isTrivialPin(pin)).toBe(true);
    },
  );

  it.each(['9876', '8765', '7654', '6543', '5432', '4321', '3210', '2109', '1098', '0987'])(
    'rejects the descending run %s',
    (pin) => {
      expect(isTrivialPin(pin)).toBe(true);
    },
  );

  it.each(['1212', '3434', '9090', '1122', '7788', '0099'])('rejects the pattern %s', (pin) => {
    expect(isTrivialPin(pin)).toBe(true);
  });

  it.each(['', '123', '12345', 'abcd', '12a4', ' 482', '4829 ', '4829\n', '٤٨٢٩'])(
    'rejects %j as not four digits',
    (pin) => {
      expect(isTrivialPin(pin)).toBe(true);
    },
  );

  it.each(['4829', '7031', '2580', '1379', '5038', '1221'])('accepts %s', (pin) => {
    expect(isTrivialPin(pin)).toBe(false);
  });

  it('leaves 9,790 of the 10,000 PINs available', () => {
    // 10 AAAA + 90 ABAB + 90 AABB + 10 ascending + 10 descending = 210 rejected.
    let accepted = 0;
    for (let n = 0; n < 10_000; n++) {
      if (!isTrivialPin(String(n).padStart(4, '0'))) accepted++;
    }
    expect(accepted).toBe(9_790);
  });
});

describe('generateRecoveryCode', () => {
  it('produces 8 upper-case characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateRecoveryCode()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    }
  });

  it('can use every allowed character and only those', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const c of generateRecoveryCode()) seen.add(c);
    expect(seen.size).toBe(31);
    for (const banned of ['0', '1', 'I', 'L', 'O']) expect(seen.has(banned)).toBe(false);
  });

  it('does not repeat', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateRecoveryCode));
    expect(codes.size).toBe(1000);
  });

  it('discards bytes that would bias the distribution', () => {
    const fill = (value: number) => (array: Uint8Array) => array.fill(value);
    const stub = vi.spyOn(globalThis.crypto, 'getRandomValues');

    stub.mockImplementation(fill(0) as never);
    const allZero = generateRecoveryCode();

    stub.mockReset();
    // 255 % 31 = 7, so keeping these bytes would give a different code from all-zero bytes.
    stub.mockImplementationOnce(fill(255) as never).mockImplementation(fill(0) as never);
    expect(generateRecoveryCode()).toBe(allZero);
  });
});

describe('normalizeRecoveryCode', () => {
  it.each([
    ['ab3d-ef7h', 'AB3DEF7H'],
    ['  AB3D EF7H ', 'AB3DEF7H'],
    ['AB3DEF7H', 'AB3DEF7H'],
  ])('turns %j into %s', (input, want) => {
    expect(normalizeRecoveryCode(input)).toBe(want);
  });
});
