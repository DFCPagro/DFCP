// seeders/users/seedUsers.ts
/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';
import User from '../../../src/models/user.model';
import type { Role } from '../../../src/utils/constants';

const STATIC_USERS_PATH = '../data/users.data.json';

// ---- Types (input DTOs for seeding only) ----
type AddressInput = {
  lnt: number;          // longitude
  alt: number;          // latitude
  address: string;
  label?: string;
  isPrimary?: boolean;
};

type AddressModelShape = {
  lnt: number;
  alt: number;
  address: string;
  logisticCenterId?: string | null; // model default is null
};

type SeedUserInput = {
  _id?: string;         // <-- allow static _id from JSON (24-hex)
  name: string;
  email: string;
  password: string;     // plain text in seed data; model will hash on save/create
  role: Role;
  activeStatus: boolean;
  uid: string;
  addresses?: AddressInput[]; // optional (legacy may use single address)
  address?: AddressInput;     // legacy single address
  birthday?: Date | string;   // optional in input
  phone?: string;             // optional in input
};

// What we actually send to Mongo (keeps optional _id if provided)
type SeedUserToInsert = {
  _id?: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  activeStatus: boolean;
  uid: string;
  addresses: AddressModelShape[];
  birthday?: Date | string;
  phone?: string;
};

// ---- Helpers ----
const isHex24 = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

/** Israel-ish random address (alt=lat, lnt=lng) */
const randomIsraelAddress = (label = 'Home'): AddressInput => {
  const alt = rand(29.5, 33.5);   // latitude
  const lnt = rand(34.25, 35.9);  // longitude
  const street = faker.location.streetAddress();
  return {
    lnt: Number(lnt.toFixed(6)),
    alt: Number(alt.toFixed(6)),
    address: `${street}, Israel`,
    label,
  };
};

// Resolve JSON: ../data/users.data.json (relative to this file)
const USER_DATA_FILE = path.join(__dirname, STATIC_USERS_PATH);

// --- Normalizers / Guards ---
function toArrayAddresses(u: SeedUserInput): AddressInput[] {
  if (Array.isArray(u.addresses) && u.addresses.length > 0) {
    return u.addresses.map(a => ({ ...a }));
  }
  if (u.address && typeof u.address === 'object') {
    return [{ ...u.address, label: u.address.label ?? 'Home', isPrimary: true }];
  }
  return [{ ...randomIsraelAddress('Home'), isPrimary: true }];
}

function ensureOnePrimary(addresses: AddressInput[]): AddressInput[] {
  const copy = addresses.map(a => ({ ...a }));
  const primaryCount = copy.filter(a => a.isPrimary).length;
  if (primaryCount === 0) {
    copy[0].isPrimary = true;
  } else if (primaryCount > 1) {
    let seen = false;
    for (const a of copy) {
      if (a.isPrimary && !seen) {
        seen = true;
      } else {
        a.isPrimary = false;
      }
    }
  }
  return copy;
}

function toModelAddress(a: AddressInput): AddressModelShape {
  return {
    lnt: a.lnt,
    alt: a.alt,
    address: a.address,
    logisticCenterId: null, // explicit to match schema default
  };
}

function normalizeUser(u: SeedUserInput): SeedUserToInsert {
  const normalizedAddresses = ensureOnePrimary(toArrayAddresses(u)).map(toModelAddress);

  const base: SeedUserToInsert = {
    name: u.name,
    email: String(u.email).toLowerCase().trim(),
    password: u.password, // plain here; model will hash on save/create
    role: u.role,
    activeStatus: u.activeStatus,
    uid: u.uid,
    addresses: normalizedAddresses,
  };

  if (u._id !== undefined) {
    if (!isHex24(u._id)) {
      throw new Error(`users.data.json: _id "${u._id}" must be a 24-hex string`);
    }
    base._id = u._id; // let Mongoose cast to ObjectId
  }
  if (u.birthday !== undefined) base.birthday = u.birthday;
  if (u.phone !== undefined) base.phone = u.phone;

  return base;
}

function loadFixedUsers(): SeedUserToInsert[] {
  if (!fs.existsSync(USER_DATA_FILE)) {
    throw new Error(
      `Missing users.data.json at: ${USER_DATA_FILE}\n` +
      `Create it as a plain JSON array (no wrapper).`
    );
  }
  const parsed = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
  if (!Array.isArray(parsed)) {
    throw new Error('users.data.json must be a JSON array (no { "users": [] } wrapper).');
  }
  return (parsed as SeedUserInput[]).map(normalizeUser);
}

function buildRandomCustomer(index: number): SeedUserToInsert {
  const home = randomIsraelAddress('Home');
  const maybeWork = randomIsraelAddress('Work');

  const addresses = ensureOnePrimary([
    { ...home, isPrimary: true },
    ...(Math.random() < 0.5 ? [maybeWork] : []),
  ]).map(toModelAddress);

  return {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: 'Password!1', // model pre-save hook will hash
    role: 'customer',
    activeStatus: true,
    uid: `USR-${index}`,
    birthday: faker.date.birthdate({ min: 18, max: 70, mode: 'age' }),
    phone: faker.phone.number(),
    addresses,
  };
}

// ---- Main seeder ----
export async function seedUsers(options?: { random?: number; clear?: boolean }) {
  const randomCount = Number.isFinite(options?.random) ? Number(options!.random) : 0;
  const shouldClear = options?.clear !== false; // default true

  const fixedUsers = loadFixedUsers();

  console.log(
    `🌱 Seeding ${fixedUsers.length} fixed users${randomCount ? ` + ${randomCount} random` : ''}…`
  );

  if (shouldClear) {
    await User.deleteMany({});
    console.log('🧹 Cleared existing users');
  }

  // Use Model.create (NOT insertMany) so pre('save') hashing runs.
  // This also respects provided _id values.
  if (fixedUsers.length) {
    await User.create(fixedUsers);
  }

  if (randomCount > 0) {
    const randoms: SeedUserToInsert[] = [];
    for (let i = 1; i <= randomCount; i++) {
      randoms.push(buildRandomCustomer(i));
    }
    if (randoms.length) {
      await User.create(randoms);
    }
  }

  console.log('✅ Users seeded');
}

// ---- CLI support ----
// Usage examples:
//   ts-node seedUsers.ts             -> seeds only JSON users, clears collection
//   ts-node seedUsers.ts --random 10 -> also adds 10 faker customers
//   ts-node seedUsers.ts --keep      -> do not clear existing users
if (require.main === module) {
  const args = process.argv.slice(2);
  const randomIdx = args.findIndex(a => a === '--random');
  const random =
    randomIdx !== -1 && args[randomIdx + 1] ? Number(args[randomIdx + 1]) : 0;
  const keep = args.includes('--keep');

  seedUsers({ random, clear: !keep }).catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}

export default seedUsers;
