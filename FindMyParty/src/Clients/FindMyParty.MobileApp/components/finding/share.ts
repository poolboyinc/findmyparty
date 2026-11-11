import { Platform, Share } from 'react-native';
import { ApiConstants } from '@/constants/api';

/**
 * A link to a share page on the API (`/p/{id}`, `/v/{id}`): it shows a preview in messages and opens the app.
 * The pages live on the same host as the API (`Public:BaseUrl` on the server).
 */
export function publicLink(path: string): string {
  return `${ApiConstants.GatewayBaseUrl.replace(/\/+$/, '')}${path}`;
}

/** Opens the share sheet with a line and its link. Dismissing it, or having nothing to share with, is fine. */
export async function shareLink(title: string, line: string, path: string): Promise<void> {
  const url = publicLink(path);
  try {
    // iOS sends `url` as a link with a preview next to the message; Android only sends the message.
    await Share.share(Platform.OS === 'ios' ? { title, message: line, url } : { title, message: `${line} ${url}` });
  } catch {
    // Dismissed, or nothing to share with. Nothing to do.
  }
}
