import { Platform, Share } from 'react-native';

/** Opens the share sheet with the account's invite link (`FriendsList.inviteUrl`). A cancelled sheet is not an error. */
export function shareInvite(inviteUrl: string): void {
  const message = 'Add me on FindMyParty';
  // iOS shows the link as a link when it is passed as `url`; Android only takes a message.
  const content = Platform.OS === 'ios' ? { message, url: inviteUrl } : { message: `${message}: ${inviteUrl}` };
  Share.share(content).catch(() => {});
}
