import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../../src/models';            // adjust if your export differs
import type { Role } from '../../src/utils/constants';

const ACCESS = process.env.JWT_ACCESS_SECRET || 'test-access-secret';

const randHex = (bytes = 4) => crypto.randomBytes(bytes).toString('hex');

export async function createUser(role: Role, overrides: Partial<any> = {}) {
  const email = overrides.email ?? `${role}-${randHex()}@test.com`;
  const uid = overrides.uid ?? `${role.toUpperCase()}-${randHex(3)}`;

  const user = await User.create({
    name: `${role}-user`,
    email,
    password: 'Password!1',   // model should hash via pre-save
    role,
    activeStatus: true,
    uid,
    addresses: [
      { lnt: 34.781768, alt: 32.0853, address: 'Tel Aviv, IL', logisticCenterId: null },
    ],
    ...overrides,
  });
  return user;
}

export function signAccess(userId: string) {
  return jwt.sign({ sub: userId }, ACCESS, { expiresIn: '1h' });
}
