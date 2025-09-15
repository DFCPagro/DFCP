/**
 * Central place to quiet noisy libs during tests.
 * We only suppress known, harmless messages.
 */
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

// Toggle to see logs locally (Jest env var is handy)
const DEBUG_TEST_LOGS = process.env.DEBUG_TEST_LOGS === "1";

// Known noisy patterns to drop
const DROP_PATTERNS: RegExp[] = [
  // Mongoose duplicate index spam
  /\[MONGOOSE\]\s+Warning:\s+Duplicate schema index/i,

  // MongoMemoryServer occasional disconnect noise on shutdown
  /MongoNetworkError: read ECONNRESET/i,

  // dotenv v17 banners
  /^\[dotenv@\d+\.\d+\.\d+\]\s+injecting env/i,
  /tip:\s/i,

  // your seeders (only during tests)
  /^🌱 Seeding/i,
  /^🧹 Cleared existing items/i,
  /^✅ Inserted \d+ items/i,
  /^🎉 Items seeded successfully/i,
];

function shouldDrop(args: any[]) {
  const msg = args.map(String).join(" ");
  return DROP_PATTERNS.some((re) => re.test(msg));
}

console.log = (...args: any[]) => {
  if (!DEBUG_TEST_LOGS && shouldDrop(args)) return;
  origLog(...args);
};

console.warn = (...args: any[]) => {
  if (!DEBUG_TEST_LOGS && shouldDrop(args)) return;
  origWarn(...args);
};

console.error = (...args: any[]) => {
  // keep actual stack traces/errors; only drop known shutdown noise
  if (!DEBUG_TEST_LOGS && shouldDrop(args)) return;
  origError(...args);
};
