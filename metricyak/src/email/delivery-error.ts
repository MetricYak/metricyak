export type EmailDeliveryErrorDetails = {
  provider: string;
  code: string | null;
  responseCode: number | null;
};

export class EmailDeliveryError extends Error {
  readonly provider: string;
  readonly code: string | null;
  readonly responseCode: number | null;

  constructor({ provider, code, responseCode }: EmailDeliveryErrorDetails) {
    super(`Email delivery through ${provider} failed`);
    this.name = "EmailDeliveryError";
    this.provider = provider;
    this.code = code;
    this.responseCode = responseCode;
  }
}
