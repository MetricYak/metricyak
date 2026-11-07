import type { EmailConfig } from "@/config/index.js";
import type { Logger } from "@/logger/index.js";
import { EmailDeliveryError } from "./delivery-error.js";
import { SmtpTransport } from "./smtp-transport.js";

export { EmailDeliveryError };

export type EmailAddress = {
  email: string;
  name?: string;
};

export type EmailMessage = {
  to: EmailAddress[];
  subject: string;
  html: string;
  text: string;
};

export type OutgoingEmail = Omit<EmailMessage, "to"> & {
  from: string;
  to: EmailAddress;
};

export interface EmailTransport {
  send(email: OutgoingEmail): Promise<void>;
}

export class EmailService {
  private readonly transport: EmailTransport | null;
  private readonly from: string | null;
  private readonly logger: Logger;

  constructor(transport: EmailTransport | null, from: string | null, logger: Logger) {
    this.transport = transport;
    this.from = from;
    this.logger = logger;
  }

  get isAvailable(): boolean {
    return this.transport !== null && this.from !== null;
  }

  async send(message: EmailMessage): Promise<void> {
    const { to } = message;
    const transport = this.transport;
    const from = this.from;
    if (!transport || !from) {
      this.logger.debug({ recipients: to.length }, "Email not sent: no email provider configured");
      return;
    }

    const results = await Promise.allSettled(
      to.map((recipient) => transport.send({ ...message, from, to: recipient })),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        this.logger.error({ err: safeError(result.reason) }, "Email send failed");
      }
    }
  }
}

function safeError(err: unknown): EmailDeliveryError {
  if (err instanceof EmailDeliveryError) {
    return err;
  }
  return new EmailDeliveryError({ provider: "unknown", code: null, responseCode: null });
}

function createTransport(config: EmailConfig): EmailTransport | null {
  switch (config.provider.type) {
    case "smtp":
      return new SmtpTransport(config.provider);
    case "none":
      return null;
  }
}

export function createEmailService(config: EmailConfig, logger: Logger): EmailService {
  return new EmailService(createTransport(config), config.from, logger);
}
