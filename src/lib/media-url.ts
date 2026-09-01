/** URL for the authenticated media route serving a stored object key. */
export function mediaUrl(storageKey: string): string {
  return `/api/media/${storageKey}`;
}
