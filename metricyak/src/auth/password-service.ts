import { PasswordHasher } from "./password-hasher.js";
import { type PasswordStrength, PasswordStrengthChecker } from "./password-strength-checker.js";

export class PasswordService {
  private readonly hasher: PasswordHasher;
  private readonly strengthChecker: PasswordStrengthChecker;
  private dummyPasswordHash: Promise<string> | undefined;

  constructor(hasher: PasswordHasher, strengthChecker: PasswordStrengthChecker) {
    this.hasher = hasher;
    this.strengthChecker = strengthChecker;
  }

  hashPassword(password: string): Promise<string> {
    return this.hasher.hash(password);
  }

  verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return this.hasher.verify(passwordHash, password);
  }

  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyPasswordHash ??= this.hasher.hash("metricyak-dummy-password");
    await this.hasher.verify(await this.dummyPasswordHash, password);
  }

  checkPasswordStrength(password: string, userInputs: string[]): PasswordStrength {
    return this.strengthChecker.check(password, userInputs);
  }
}

export function createPasswordService(): PasswordService {
  return new PasswordService(new PasswordHasher(), new PasswordStrengthChecker());
}
