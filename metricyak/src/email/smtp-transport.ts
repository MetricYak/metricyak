import { createTransport, type NodemailerError, type Transporter } from "nodemailer";
import type { EmailProviderConfig } from "@/config/index.js";
import { EmailDeliveryError } from "./delivery-error.js";
import type { EmailTransport, OutgoingEmail } from "./email-service.js";

type SmtpConfig = Extract<EmailProviderConfig, { type: "smtp" }>;

export class SmtpTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = createTransport({
      pool: true,
      host: config.host,
      port: config.port,
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: email.from,
        to: { name: email.to.name ?? "", address: email.to.email },
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (err) {
      const { code, responseCode } = err as NodemailerError;
      throw new EmailDeliveryError({ provider: "smtp", code: code ?? null, responseCode: responseCode ?? null });
    }
  }
}
