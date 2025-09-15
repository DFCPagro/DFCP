// Kill dotenv v17 “injecting env” banners
process.env.DOTENV_DISABLE_LOG = "true";

// Optional: reduce app/framework chatter during tests
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";
