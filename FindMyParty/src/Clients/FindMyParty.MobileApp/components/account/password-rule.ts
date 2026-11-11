// The server's password rule (Identity options in the API's Program.cs), checked on the phone before sending.

/** Shown under a new-password field, and as its error once the password falls short of it. */
export const PASSWORD_RULE = 'At least 8 characters, with a number and a lowercase letter.';

/** True when the server will take `password` as a new password. */
export function passwordOk(password: string): boolean {
  return password.length >= 8 && /[0-9]/.test(password) && /[a-z]/.test(password);
}
