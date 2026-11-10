import { ApiError } from './api.ts';

// One sentence a person can act on, for any failure. Pure, tested in services/__tests__/errorText.test.mjs.

const BY_CODE: Record<string, string> = {
  sold_out: 'Not enough spots left for that many guests.',
  not_bookable: 'This party is not open for booking.',
  ticket_count: 'A booking is for one to six guests.',
  code_expired: 'That code has expired. Ask the guest to open their pass again.',
  already_used: 'This pass has already been used.',
  booking_cancelled: 'This booking was cancelled.',
  party_cancelled: 'This party was cancelled.',
  party_over: 'This party is over.',
  invalid_code: 'That is not a FindMyParty pass.',
  locked_out: 'Too many wrong passwords. Try again in a few minutes.',
  account_exists: 'An account with this email already exists. Log in with your password.',
};

export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.';
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];

  switch (error.kind) {
    case 'offline':
      return 'No connection. Check your signal and try again.';
    case 'signed_out':
      return 'Your session has ended. Sign in again.';
    case 'rate_limited':
      return 'Too many tries. Wait a minute and try again.';
    case 'server':
      return 'Something went wrong on our side. Try again in a moment.';
    case 'forbidden':
      // The server sometimes says why, e.g. a pass for another host's party.
      return error.message && error.message !== error.kind ? error.message : 'You are not allowed to do that.';
    case 'not_found':
      return 'That could not be found. It may have been removed.';
    default:
      // The server's own sentence, unless it is just the error kind.
      return error.message && error.message !== error.kind ? error.message : 'Something went wrong. Try again.';
  }
}
