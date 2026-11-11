import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSignText,
  inputFromSignText,
  limitSignInput,
  signCharCount,
  signLines,
  signTextFromInput,
  signTextHint,
  signTextProblem,
} from '../../components/signs/sign-text.ts';

test('a stored sign splits into lines at the bar, and the bar does not count', () => {
  assert.deepEqual(signLines('AURA|SPRITZ'), ['AURA', 'SPRITZ']);
  assert.deepEqual(signLines('VOLT'), ['VOLT']);
  assert.equal(signCharCount('AURA|SPRITZ'), 10);
  assert.equal(signCharCount('NEON\nFRIDAY'), 10);
});

test('the server takes 1 to 24 characters on one or two lines', () => {
  assert.equal(signTextProblem('VOLT'), null);
  assert.equal(signTextProblem('NEON|FRIDAY'), null);
  assert.equal(signTextProblem('A'.repeat(24)), null);
  assert.equal(signTextProblem('A'.repeat(12) + '|' + 'B'.repeat(12)), null, '24 letters and a bar is fine');
  assert.equal(signTextProblem('A'.repeat(25)), 'tooLong');
  assert.equal(signTextProblem('A'.repeat(13) + '|' + 'B'.repeat(12)), 'tooLong');
  assert.equal(signTextProblem('ONE|TWO|THREE'), 'tooManyLines');
  assert.equal(signTextProblem(''), 'empty');
  assert.equal(signTextProblem('  |  '), 'empty');
});

test('the hint counts what is left, or says the rule', () => {
  assert.equal(signTextHint('NEON|FRIDAY'), '10 of 24');
  assert.equal(signTextHint(''), 'Write a word or two for the sign.');
  assert.equal(signTextHint('A'.repeat(25)), 'Up to 24 characters on two lines.');
});

test('typing stays inside two lines and 24 characters', () => {
  assert.equal(limitSignInput('NEON\nFRIDAY'), 'NEON\nFRIDAY');
  assert.equal(limitSignInput('NEON\nFRIDAY\nNIGHT'), 'NEON\nFRIDAY NIGHT', 'a third line joins the second');
  assert.equal(limitSignInput('A'.repeat(30)), 'A'.repeat(24));
  assert.equal(limitSignInput('A'.repeat(20) + '\n' + 'B'.repeat(10)), 'A'.repeat(20) + '\n' + 'BBBB');
  assert.equal(limitSignInput('NEON '), 'NEON ', 'a trailing space survives so the next word can be typed');
  assert.equal(limitSignInput('NEON|FRIDAY'), 'NEON\nFRIDAY', 'a typed bar is a line break');
});

test('what is typed is stored with a bar between trimmed lines', () => {
  assert.equal(signTextFromInput('  neon \n  friday  '), 'neon|friday');
  assert.equal(signTextFromInput('NEON\n\n'), 'NEON');
  assert.equal(signTextFromInput('ladies   night'), 'ladies night');
  assert.equal(inputFromSignText('AURA|SPRITZ'), 'AURA\nSPRITZ');
});

test('the first sign is the party title in capitals, balanced over two lines', () => {
  assert.equal(defaultSignText('Neon Friday'), 'NEON|FRIDAY');
  assert.equal(defaultSignText('Volt'), 'VOLT');
  assert.equal(defaultSignText('Ladies Night at Atlas'), 'LADIES NIGHT|AT ATLAS');
  assert.equal(defaultSignText(''), '');
  const long = defaultSignText('The Very Long Party Name Of The Season');
  assert.equal(signTextProblem(long), null, long);
  assert.equal(defaultSignText('Supercalifragilisticexpialidocious'), 'SUPERCALIFRAGILISTICEXPI');
});
