import assert from 'node:assert/strict';
import { test } from 'node:test';
import { friendsLineInitials, friendsLineText } from '../../components/finding/friends-text.ts';

test('one friend: "Mila is here"', () => {
  assert.equal(friendsLineText({ count: 1, names: ['Mila'], initials: ['M'] }), 'Mila is here');
});

test('two friends are both named', () => {
  assert.equal(friendsLineText({ count: 2, names: ['Mila', 'Luka'], initials: ['M', 'L'] }), 'Mila and Luka are here');
});

test('three or more: the first name and how many others', () => {
  assert.equal(friendsLineText({ count: 3, names: ['Mila', 'Luka'], initials: ['M', 'L', 'A'] }), 'Mila and 2 friends are here');
  assert.equal(friendsLineText({ count: 6, names: ['Mila', 'Luka'], initials: ['M', 'L', 'A'] }), 'Mila and 5 friends are here');
});

test('two friends with one name: the other is "1 friend"', () => {
  assert.equal(friendsLineText({ count: 2, names: ['Mila'], initials: ['M', 'L'] }), 'Mila and 1 friend are here');
});

test('nobody, or no data, gives no line', () => {
  assert.equal(friendsLineText({ count: 0, names: [], initials: [] }), null);
  assert.equal(friendsLineText(undefined), null);
  assert.equal(friendsLineText(null), null);
});

test('no names at all still says how many', () => {
  assert.equal(friendsLineText({ count: 1, names: [], initials: [] }), 'A friend is here');
  assert.equal(friendsLineText({ count: 4, names: [], initials: [] }), '4 friends are here');
});

test('two circles at most are drawn, as on the mock', () => {
  assert.deepEqual(friendsLineInitials({ count: 3, names: ['Mila', 'Luka'], initials: ['M', 'L', 'A'] }), ['M', 'L']);
  assert.deepEqual(friendsLineInitials(undefined), []);
});
