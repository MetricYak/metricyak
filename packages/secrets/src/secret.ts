import { inspect } from 'node:util';

const REDACTED = '[redacted]';

export class Secret {
  private constructor(private readonly plaintext: string) {}

  static of(plaintext: string): Secret {
    return new Secret(plaintext);
  }

  expose(): string {
    return this.plaintext;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}
