import { faker } from '@faker-js/faker';
import User from '../../../src/models/user.model';
import { roles, Role } from '../../../src/utils/constants';

// Helper: Israel-ish bounding box
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
/**
 * Build an Address object matching the schema:
 * { lnt: number; alt: number; address: string }
 * alt = latitude, lnt = longitude (yes, names are swapped in the type)
 */
const randomIsraelAddress = () => {
  const alt = rand(29.5, 33.5);   // latitude
  const lnt = rand(34.25, 35.9);  // longitude
  const street = faker.location.streetAddress();
  return {
    lnt: Number(lnt.toFixed(6)),
    alt: Number(alt.toFixed(6)),
    address: `${street}, Israel`,
  };
};

const NUM_RANDOM_USERS = 10;

// 🔑 Fixed users for each main role
const fixedUsers: Array<{
  name: string;
  email: string;
  password: string;
  role: Role;
  activeStatus: boolean;
  uid: string;
  address: { lnt: number; alt: number; address: string };
}> = [
  {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: 'admin123',
    role: 'admin',
    activeStatus: true,
    uid: 'ADM-1',
    address: { lnt: 34.781768, alt: 32.0853, address: 'Tel Aviv-Yafo, Israel' },
  },
  {
    name: 'Deliverer User',
    email: 'deliverer@gmail.com',
    password: 'deliverer123',
    role: 'deliverer',
    activeStatus: true,
    uid: 'DLV-1',
    address: { lnt: 35.21371, alt: 31.768318, address: 'Jerusalem, Israel' },
  },
  {
    name: 'Industrial Deliverer User',
    email: 'indeliverer@gmail.com',
    password: 'indeliverer123',
    role: 'industrialDeliverer',
    activeStatus: true,
    uid: 'IDL-1',
    address: { lnt: 34.989571, alt: 32.794048, address: 'Haifa, Israel' },
  },
  {
    name: 'Distribution Manager',
    email: 'dmanager@gmail.com',
    password: 'dmanager123',
    role: 'dManager',
    activeStatus: true,
    uid: 'DMG-1',
    address: { lnt: 34.886917, alt: 31.25181, address: 'Ashdod, Israel' },
  },
  {
    name: 'Farm Manager',
    email: 'fmanager@gmail.com',
    password: 'fmanager123',
    role: 'fManager',
    activeStatus: true,
    uid: 'FMG-1',
    address: { lnt: 34.799335, alt: 32.07225, address: 'Ramat Gan, Israel' },
  },
  {
    name: 'Operations Manager',
    email: 'opmanager@gmail.com',
    password: 'opmanager123',
    role: 'opManager',
    activeStatus: true,
    uid: 'OPM-1',
    address: { lnt: 34.75, alt: 32.05, address: 'Petah Tikva, Israel' },
  },
  {
    name: 'Customer User',
    email: 'customer@gmail.com',
    password: 'customer123',
    role: 'customer',
    activeStatus: true,
    uid: 'CNS-1',
    address: { lnt: 34.959, alt: 32.82, address: 'Netanya, Israel' },
  },
  {
    name: 'Farmer User',
    email: 'farmer@gmail.com',
    password: 'farmer123',
    role: 'farmer',
    activeStatus: true,
    uid: 'FMR-1',
    address: { lnt: 34.7, alt: 31.8, address: 'Beer Sheva, Israel' },
  },
];

export async function seedUsers() {
  console.log(`🌱 Seeding fixed users + ${NUM_RANDOM_USERS} random users…`);

  // DEV ONLY: clear existing users
  await User.deleteMany({});

  // Fixed users (passwords hashed by pre-save hook)
  for (const userData of fixedUsers) {
    const user = new User(userData);
    await user.save();
  }

  // Random customer users
  for (let i = 0; i < NUM_RANDOM_USERS; i++) {
    const user = new User({
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      password: 'Password!1', // hashed by pre-save hook
      birthday: faker.date.birthdate({ min: 18, max: 70, mode: 'age' }),
      phone: faker.phone.number(),
      role: 'customer',
      activeStatus: true,
      uid: `USR-${i + 1}`,
      address: randomIsraelAddress(),
    });
    await user.save();
  }

  console.log('✅ Users seeded');
}

export default seedUsers;
