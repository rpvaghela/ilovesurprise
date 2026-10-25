import { expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/utils/jwt';

it('accepts an unexpired server-issued referral token', () => {
  const token = signToken({ id: 'rep', purpose: 'referral' }, { expiresIn: '60d' });
  expect(verifyToken(token)).toMatchObject({ id: 'rep', purpose: 'referral' });
});

it('rejects expired referral attribution even if the browser retains the cookie', () => {
  const token = signToken({ id: 'rep', purpose: 'referral' }, { expiresIn: -1 });
  expect(verifyToken(token)).toBeNull();
});

it('rejects changed affiliate IDs in referral tokens', () => {
  const token = signToken({ id: 'rep', purpose: 'referral' }, { expiresIn: '60d' });
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ id: 'another-rep', purpose: 'referral' })).toString('base64url');
  expect(verifyToken(parts.join('.'))).toBeNull();
});
