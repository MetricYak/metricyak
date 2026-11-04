import type { Config } from "@/config/index.js";

export type AppEnv = {
  Variables: {
    config: Config;
    skipRequestLog?: boolean;
  };
};
