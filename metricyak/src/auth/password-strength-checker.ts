import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

const MIN_SCORE = 3;
const MIN_USER_INPUT_LENGTH = 3;

export type PasswordStrength = {
  isStrong: boolean;
  warning: string | null;
};

export class PasswordStrengthChecker {
  private readonly zxcvbn = new ZxcvbnFactory({
    dictionary: { ...zxcvbnCommonPackage.dictionary, ...zxcvbnEnPackage.dictionary },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  });

  check(password: string, userInputs: string[]): PasswordStrength {
    const result = this.zxcvbn.check(password, userInputWords(userInputs));
    return { isStrong: result.score >= MIN_SCORE, warning: result.feedback.warning };
  }
}

function userInputWords(userInputs: string[]): string[] {
  const words = userInputs.flatMap((input) => {
    const lowered = input.toLowerCase();
    return [lowered, ...lowered.split(/[^\p{L}\p{N}]+/u)];
  });
  return [...new Set(words)].filter((word) => word.length >= MIN_USER_INPUT_LENGTH);
}
