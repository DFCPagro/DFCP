import "dotenv/config";
import app from "./app";
import { connectDB } from "./db/connect";
import logger from "./config/logger";
import { PORT, NODE_ENV } from "./config/env";
import { startCartReclaimer } from "./jobs/cart.reclaimer";

(async () => {
  try {
    await connectDB();

    // start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });

    // start reclaimer (skip in tests if you want)
    const jobs = startCartReclaimer({
      intervalMs: Number(process.env.CART_RECLAIMER_INTERVAL_MS ?? 60_000),
      enabled: (process.env.CART_RECLAIMER_ENABLED ?? "true") !== "false" && NODE_ENV !== "test",
      log: (m) => logger.info(m),
    });

    // graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      try {
        jobs.stop();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      } finally {
        // close Mongo if you want:
        // await mongoose.connection.close();
        process.exit(0);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", err);
    process.exit(1);
  }
})();
