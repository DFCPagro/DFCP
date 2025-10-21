import "dotenv/config";
import app from "./app";
import { connectDB } from "./db/connect";
import logger from "./config/logger";
import { PORT, NODE_ENV } from "./config/env";


(async () => {
  try {
    await connectDB();

    // start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  

  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", err);
    process.exit(1);
  }
})();
