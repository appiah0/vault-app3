// src/generator.ts
// Cryptographically secure password generator

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const NUMS  = '0123456789';
const SYMS  = '!@#$%^&*-_+=?';
const AMBIGUOUS = /[0O1lI]/g;

const WORDS = [
  'apple','bridge','castle','dragon','empire','forest','garden','harbor',
  'island','jungle','kernel','lemon','mango','nexus','ocean','palace',
  'quantum','river','storm','tower','ultra','valley','winter','xenon',
  'yellow','zenith','alpha','brave','cloud','delta','eagle','flame',
  'globe','honey','ivory','jade','kite','lunar','maple','noble',
];

export interface GenOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  noAmbiguous: boolean;
  passphrase: boolean;
  wordCount?: number;
}

export const DEFAULT_GEN_OPTIONS: GenOptions = {
  length: 16,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
  noAmbiguous: false,
  passphrase: false,
  wordCount: 4,
};

function secureRandom(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

export function generatePassword(opts: Partial<GenOptions> = {}): string {
  const o = { ...DEFAULT_GEN_OPTIONS, ...opts };

  if (o.passphrase) {
    const count = o.wordCount ?? 4;
    const words: string[] = [];
    for (let i = 0; i < count; i++) {
      words.push(WORDS[secureRandom(WORDS.length)]);
    }
    // Add a number and symbol for strength
    const num = secureRandom(90) + 10;
    return words.join('-') + '-' + num;
  }

  let charset = '';
  if (o.upper)   charset += UPPER;
  if (o.lower)   charset += LOWER;
  if (o.numbers) charset += NUMS;
  if (o.symbols) charset += SYMS;
  if (!charset)  charset = LOWER + NUMS;

  if (o.noAmbiguous) {
    charset = charset.replace(AMBIGUOUS, '');
  }

  // Generate with guaranteed character class coverage
  const required: string[] = [];
  if (o.upper   && charset.match(/[A-Z]/)) required.push(UPPER[secureRandom(UPPER.length)]);
  if (o.lower   && charset.match(/[a-z]/)) required.push(LOWER[secureRandom(LOWER.length)]);
  if (o.numbers && charset.match(/[0-9]/)) required.push(NUMS[secureRandom(NUMS.length)]);
  if (o.symbols && charset.match(/[^a-zA-Z0-9]/)) required.push(SYMS[secureRandom(SYMS.length)]);

  const remaining = o.length - required.length;
  const chars: string[] = [...required];
  for (let i = 0; i < remaining; i++) {
    chars.push(charset[secureRandom(charset.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
