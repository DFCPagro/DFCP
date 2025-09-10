import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';
import User from '../../../src/models/user.model';
import { Role } from '../../../src/utils/constants';

const STATIC_USERS_PATH = '../data/users.data.json';

// ---- Types ----
type Address = {
  lnt: number;          // longitude
  alt: number;          // latitude
  address: string;
  label?: string;
  isPrimary?: boolean;
};

type UserSeed = {
  name: string;
  email: string;
  password: string;
  role: Role;
  activeStatus: boolean;
  uid: string;
  // NEW: supports multi-address
  addresses?: Address[];
  // Legacy single address (we’ll normalize it)
  address?: Address;
  birthday?: Date | string;
  phone?: string;
};

// ---- Helpers ----
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

/** Israel-ish random address (alt=lat, lnt=lng) */
const randomIsraelAddress = (label = 'Home'): Address => {
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
function toArrayAddresses(u: UserSeed): Address[] {
  // If already array, clone it
  if (Array.isArray(u.addresses) && u.addresses.length > 0) {
    return u.addresses.map(a => ({ ...a }));
  }
  // If legacy single address, convert to [address] and mark as primary
  if (u.address && typeof u.address === 'object') {
    return [{ ...u.address, label: u.address.label ?? 'Home', isPrimary: true }];
  }
  // Fallback: create a dummy primary (shouldn’t happen if your data is correct)
  return [{ ...randomIsraelAddress('Home'), isPrimary: true }];
}

function ensureOnePrimary(addresses: Address[]): Address[] {
  const copy = addresses.map(a => ({ ...a }));
  const primaryCount = copy.filter(a => a.isPrimary).length;
  if (primaryCount === 0) {
    copy[0].isPrimary = true;
  } else if (primaryCount > 1) {
    // keep the first as primary, unset the rest
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

function normalizeUser(u: UserSeed): Required<UserSeed> {
  const addresses = ensureOnePrimary(toArrayAddresses(u));
  const {
    name, email, password, role, activeStatus, uid,
    birthday, phone
  } = u;

  return {
    name,
    email: email.toLowerCase(),
    password,
    role,
    activeStatus,
    uid,
    addresses,          // normalized array
    // keep legacy key off the inserted doc
    address: undefined as unknown as Address, // will be removed by spread below
    birthday,
    phone,
  } as unknown as Required<UserSeed>;
}

function loadFixedUsers(): Required<UserSeed>[] {
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
  return (parsed as UserSeed[]).map(normalizeUser);
}

function buildRandomCustomer(index: number): Required<UserSeed> {
  const home = randomIsraelAddress('Home');
  const maybeWork = randomIsraelAddress('Work');

  const addresses = ensureOnePrimary([
    { ...home, isPrimary: true },
    // 50% chance of a second “Work” address
    ...(Math.random() < 0.5 ? [maybeWork] : []),
  ]);

  return {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: 'Password!1', // model pre-save hook should hash
    role: 'customer',
    activeStatus: true,
    uid: `USR-${index}`,
    birthday: faker.date.birthdate({ min: 18, max: 70, mode: 'age' }),
    phone: faker.phone.number(),
    addresses,
    // legacy key kept as undefined (not saved)
    address: undefined as unknown as Address,
  } as unknown as Required<UserSeed>;
}

// ---- Main seeder ----
export async function seedUsers(options?: { random?: number; clear?: boolean }) {
  const randomCount = Number.isFinite(options?.random) ? Number(options!.random) : 0;
  const shouldClear = options?.clear !== false; // default true

  // Load & normalize fixed users from your JSON
  const fixedUsers = loadFixedUsers();

  console.log(
    `🌱 Seeding ${fixedUsers.length} fixed users${randomCount ? ` + ${randomCount} random` : ''}…`
  );

  if (shouldClear) {
    await User.deleteMany({});
    console.log('🧹 Cleared existing users');
  }

  // Insert fixed users (passwords hashed by pre-save hook)
  // Strip legacy `address` key before insert (if any)
  await User.insertMany(
    fixedUsers.map(({ address: _legacy, ...u }) => u as any)
  );

  // Optionally add random customers
  if (randomCount > 0) {
    const randoms: Required<UserSeed>[] = [];
    for (let i = 1; i <= randomCount; i++) {
      randoms.push(buildRandomCustomer(i));
    }
    await User.insertMany(
      randoms.map(({ address: _legacy, ...u }) => u as any)
    );
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
