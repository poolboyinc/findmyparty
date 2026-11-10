import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../api.ts';
import { externalErrorText, loginErrorText, registerErrorText } from '../authErrorText.ts';

test('a refused login is a wrong email or password', () => {
  assert.equal(loginErrorText(new ApiError('signed_out', 'Unauthorized', 401)), 'Wrong email or password.');
});

test('a lockout and no connection keep their own sentence on login', () => {
  assert.equal(
    loginErrorText(new ApiError('rate_limited', 'Too many wrong passwords.', 429, 'locked_out')),
    'Too many wrong passwords. Try again in a few minutes.',
  );
  assert.equal(loginErrorText(new ApiError('offline')), 'No connection. Check your signal and try again.');
});

test('a refused sign-up shows the first reason the server gave', () => {
  const data = [
    { code: 'DuplicateUserName', description: "Username 'vule' is already taken." },
    { code: 'PasswordRequiresDigit', description: "Passwords must have at least one digit ('0'-'9')." },
  ];
  assert.equal(registerErrorText(new ApiError('invalid', undefined, 400, undefined, data)), "Username 'vule' is already taken.");
});

test('a refused sign-up with no readable reason still says what to check', () => {
  const fallback = 'Could not create the account. Check the email and password.';
  assert.equal(registerErrorText(new ApiError('invalid', undefined, 400)), fallback);
  assert.equal(registerErrorText(new ApiError('invalid', 'One or more validation errors occurred.', 400, undefined, { title: 'x' })), fallback);
  assert.equal(registerErrorText(new ApiError('invalid', undefined, 400, undefined, [{ code: 'x' }])), fallback);
});

test('no connection on sign-up is said plainly', () => {
  assert.equal(registerErrorText(new ApiError('offline')), 'No connection. Check your signal and try again.');
});

test('provider sign-in names the provider unless the server gave a reason', () => {
  assert.equal(externalErrorText('Google', new ApiError('signed_out', undefined, 401)), 'Could not sign in with Google. Try again.');
  assert.equal(externalErrorText('Apple', new Error('ERR_REQUEST_FAILED')), 'Could not sign in with Apple. Try again.');
  assert.equal(externalErrorText('Apple', new ApiError('offline')), 'No connection. Check your signal and try again.');
  assert.equal(
    externalErrorText('Google', new ApiError('conflict', 'x', 409, 'account_exists')),
    'An account with this email already exists. Log in with your password.',
  );
});
