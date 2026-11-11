// The cyan line under a party or venue when friends are there. Pure (no React Native imports), so it runs in plain Node.
import type { FriendsHere } from '../../types/api.ts';

/**
 * "Mila is here", "Mila and Luka are here", "Mila and 2 friends are here". Null when nobody is there.
 * The server sends at most two names; the count says how many there are in all.
 */
export function friendsLineText(friends: FriendsHere | null | undefined): string | null {
  if (!friends) return null;
  const count = Math.max(0, Math.floor(friends.count));
  if (count === 0) return null;
  const names = friends.names.map((name) => name.trim()).filter(Boolean);
  const first = names[0];

  if (!first) return count === 1 ? 'A friend is here' : `${count} friends are here`;
  if (count === 1) return `${first} is here`;
  if (count === 2 && names[1]) return `${first} and ${names[1]} are here`;
  const others = count - 1;
  return `${first} and ${others} ${others === 1 ? 'friend' : 'friends'} are here`;
}

/** The circles drawn beside the line: two at most, as on the mock; the sentence carries the count. */
export function friendsLineInitials(friends: FriendsHere | null | undefined): string[] {
  return (friends?.initials ?? []).filter((initial) => initial.trim().length > 0).slice(0, 2);
}
