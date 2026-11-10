import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hmacSha256Hex, passCode, passQrText, passStepAt, secondsUntilNextCode } from '../passCode.ts';

const bytes = (...b) => Uint8Array.from(b);
const ascii = (s) => Uint8Array.from(Buffer.from(s, 'ascii'));

test('HMAC-SHA256 matches the published test vectors (RFC 4231)', () => {
  assert.equal(hmacSha256Hex(new Uint8Array(20).fill(0x0b), ascii('Hi There')),
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  assert.equal(hmacSha256Hex(ascii('Jefe'), ascii('what do ya want for nothing?')),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  // A key longer than one block is hashed first.
  assert.equal(hmacSha256Hex(new Uint8Array(131).fill(0xaa), ascii('Test Using Larger Than Block-Size Key - Hash Key First')),
    '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
});

test('the phone computes the same door code as the server', () => {
  // Same vector as PassCodeTests.A_known_secret_and_time_give_a_known_code in the API tests.
  const secret = Buffer.from(bytes(...Array.from({ length: 32 }, (_, i) => i))).toString('base64');

  assert.equal(passCode(secret, 59_000_000), 'e88c8498');
});

test('the code is the same within half a minute and different in the next', () => {
  const t = Date.UTC(2026, 10, 13, 23, 0, 0);

  assert.equal(passStepAt(t), passStepAt(t + 29_999));
  assert.equal(passStepAt(t) + 1, passStepAt(t + 30_000));
});

test('the countdown says how long the current code lasts', () => {
  const t = Date.UTC(2026, 10, 13, 23, 0, 0);

  assert.equal(secondsUntilNextCode(t), 30);
  assert.equal(secondsUntilNextCode(t + 6_000), 24);
  assert.equal(secondsUntilNextCode(t + 29_500), 1);
});

test('the QR text is what the door scanner expects', () => {
  assert.equal(passQrText('3F2504E0-4F89-11D3-9A0C-0305E82C3301', 'e88c8498'), 'fmp1.3f2504e04f8911d39a0c0305e82c3301.e88c8498');
});
