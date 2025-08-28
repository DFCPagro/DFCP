// db/seeds/dev/users.seed.ts
import { faker } from '@faker-js/faker';
import User from '../../../src/models/user.model';

const NUM_RANDOM_USERS = 10;

// 🔑 Fixed users
const fixedUsers = [
  {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: 'admin123',
    role: 'admin',
    status: true,
    uid: 'ADM-1',
  },
  {
    name: 'driver User',
    email: 'driver@gmail.com',
    password: 'driver123',
    role: 'driver',
    status: true,
    uid: 'MGR-1',
  },
  {
    name: 'Consumer User',
    email: 'consumer@gmail.com',
    password: 'consumer123',
    role: 'consumer',
    status: true,
    uid: 'CNS-1',
  },
];

export async function seedUsers() {
  console.log(`🌱 Seeding fixed users + ${NUM_RANDOM_USERS} random users…`);

  // Clear old users (dev only)
  await User.deleteMany({});

  // Insert fixed users (passwords hashed by pre-save hook)
  for (const userData of fixedUsers) {
    const user = new User(userData);
    await user.save();
  }

  // Insert random users
  for (let i = 0; i < NUM_RANDOM_USERS; i++) {
    const user = new User({
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      password: 'Password!1', // hashed by pre-save hook
      birthday: faker.date.birthdate(),
      phone: faker.phone.number(),
      role: 'consumer',
      status: true,
      uid: `USR-${i + 1}`,
    });
    await user.save();
  }

  console.log('✅ Users seeded');
}
