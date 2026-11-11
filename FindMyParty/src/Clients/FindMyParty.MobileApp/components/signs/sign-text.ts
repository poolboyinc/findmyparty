// The words on a sign (S-20). Pure: no React, no `@/` imports (tested in services/__tests__/signText.test.mjs).
//
// The server stores a sign's words as one string where `|` starts the second line: "NEON|FRIDAY".
// It takes 1 to 24 characters, not counting the `|`, on one or two lines (`sign_invalid`), and the
// map's sign-art endpoint refuses the same. The editor works with a newline instead of `|`.

export const SIGN_MAX_CHARS = 24;
export const SIGN_MAX_LINES = 2;

export type SignTextProblem = 'empty' | 'tooLong' | 'tooManyLines';

/** The lines of a stored sign text: "AURA|SPRITZ" → ["AURA", "SPRITZ"]. */
export function signLines(text: string): string[] {
  return text.split('|');
}

/** Characters that count against the limit: everything but the line break. */
export function signCharCount(text: string): number {
  return text.replace(/[|\n]/g, '').length;
}

/** What is wrong with a stored sign text, or null when the server will take it. */
export function signTextProblem(text: string): SignTextProblem | null {
  const lines = signLines(text);
  if (lines.length > SIGN_MAX_LINES) return 'tooManyLines';
  if (lines.every((line) => line.trim() === '')) return 'empty';
  if (signCharCount(text) > SIGN_MAX_CHARS) return 'tooLong';
  return null;
}

/** What the editor shows under the words: "11 of 24" or why it cannot be booked. */
export function signTextHint(text: string): string {
  switch (signTextProblem(text)) {
    case 'empty':
      return 'Write a word or two for the sign.';
    case 'tooLong':
    case 'tooManyLines':
      return 'Up to 24 characters on two lines.';
    default:
      return `${signCharCount(text)} of ${SIGN_MAX_CHARS}`;
  }
}

/**
 * Keeps what is typed inside the limits while typing: two lines at most (a third line joins the
 * second) and 24 characters, cut from the end. Spaces are left alone so a word can still be typed.
 */
export function limitSignInput(raw: string): string {
  const typed = raw.replace(/\r/g, '').replace(/\|/g, '\n').split('\n');
  const lines = typed.length > SIGN_MAX_LINES ? [typed[0], typed.slice(1).join(' ')] : typed;
  let room = SIGN_MAX_CHARS;
  const kept: string[] = [];
  for (const line of lines) {
    const part = line.slice(0, Math.max(0, room));
    room -= part.length;
    kept.push(part);
  }
  return kept.join('\n');
}

/** The stored form of what was typed: lines trimmed, spaces collapsed, empty lines dropped, `|` between. */
export function signTextFromInput(raw: string): string {
  return limitSignInput(raw)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('|');
}

/** The editor's form of a stored text. */
export function inputFromSignText(text: string): string {
  return text.replace(/\|/g, '\n');
}

/**
 * A first sign made from a party's title, in capitals, like the mock's "NEON|FRIDAY": two words or
 * more on two lines split where the halves are closest in length, words dropped from the end until
 * it fits, and a single long word cut to 24.
 */
export function defaultSignText(title: string): string {
  let words = title.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  // Two lines: one of the spaces becomes the `|`, which does not count.
  while (words.length > 1 && words.join(' ').length - 1 > SIGN_MAX_CHARS) words = words.slice(0, -1);
  if (words.length === 1) return words[0].slice(0, SIGN_MAX_CHARS);

  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }
  return `${words.slice(0, best).join(' ')}|${words.slice(best).join(' ')}`;
}
