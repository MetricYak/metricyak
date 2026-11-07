import type { Config } from "@/config/index.js";
import type { Database } from "@/db/index.js";
import type { EmailService } from "@/email/email-service.js";

export type AppEnv = {
  Variables: {
    config: Config;
    db: Database;
    emailService: EmailService;
    skipRequestLog?: boolean;
  };
};
