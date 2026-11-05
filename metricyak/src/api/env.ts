import type { Config } from "@/config/index.js";
import type { Database } from "@/db/index.js";

export type AppEnv = {
  Variables: {
    config: Config;
    db: Database;
    skipRequestLog?: boolean;
  };
};
