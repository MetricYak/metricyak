import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(0).max(65535).default(3000),
    DATABASE_URL: z.url(),
    EMAIL_PROVIDER: z.enum(["smtp"]).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_VERIFICATION_REQUIRED: booleanString.default(true),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  })
  .superRefine((vars, ctx) => {
    if (vars.EMAIL_PROVIDER && !vars.EMAIL_FROM) {
      ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Required when EMAIL_PROVIDER is set" });
    }
    if (vars.EMAIL_PROVIDER === "smtp" && !vars.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "Required when EMAIL_PROVIDER is smtp" });
    }
  });

type EnvVars = z.infer<typeof envSchema>;

export type EmailProviderConfig = { type: "none" } | { type: "smtp"; host: string; port: number };

export type EmailConfig = {
  provider: EmailProviderConfig;
  from: string | null;
  verificationRequired: boolean;
};

export type Config = ReturnType<typeof loadConfig>;

function emailProvider(vars: EnvVars): EmailProviderConfig {
  switch (vars.EMAIL_PROVIDER) {
    case "smtp":
      return {
        type: "smtp",
        host: vars.SMTP_HOST as string,
        port: vars.SMTP_PORT,
      };
    case undefined:
      return { type: "none" };
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }

  const vars = result.data;
  const provider = emailProvider(vars);
  const email: EmailConfig = {
    provider,
    from: vars.EMAIL_FROM ?? null,
    verificationRequired: provider.type !== "none" && vars.EMAIL_VERIFICATION_REQUIRED,
  };

  return {
    env: vars.NODE_ENV,
    http: {
      port: vars.PORT,
    },
    database: {
      url: vars.DATABASE_URL,
    },
    email,
  };
}
