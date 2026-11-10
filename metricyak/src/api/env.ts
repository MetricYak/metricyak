import type { PasswordService } from "@/auth/password-service.js";
import type { SessionService } from "@/auth/session-service.js";
import type { Config } from "@/config/index.js";
import type { Database } from "@/db/index.js";
import type { OrganizationMembershipRecord } from "@/db/schema/organization-memberships.js";
import type { OrganizationRecord } from "@/db/schema/organizations.js";
import type { UserRecord } from "@/db/schema/users.js";
import type { EmailService } from "@/email/email-service.js";

export type AppEnv = {
  Variables: {
    config: Config;
    db: Database;
    emailService: EmailService;
    passwordService: PasswordService;
    sessionService: SessionService;
    skipRequestLog?: boolean;
  };
};

export type AuthenticatedEnv = {
  Variables: AppEnv["Variables"] & {
    user: UserRecord;
  };
};

export type OrganizationEnv = {
  Variables: AuthenticatedEnv["Variables"] & {
    organization: OrganizationRecord;
    membership: OrganizationMembershipRecord;
  };
};
