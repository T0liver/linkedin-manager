const URN = /urn:li:(activity|share|ugcPost):(\d+)/;
const POSTS_SLUG = /linkedin\.com\/posts\/[^/?#]*?-(activity|share|ugcPost)-(\d+)/;

/**
 * Turn a pasted post URL or URN into a post URN, without any network call.
 * Returns undefined when it can't (e.g. lnkd.in short links): ask the user for the "Copy link to post" URL instead.
 */
export function parsePostUrn(input: string): string | undefined {
  let s = input.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep as typed */
  }
  const m = URN.exec(s) ?? POSTS_SLUG.exec(s);
  return m ? `urn:li:${m[1]}:${m[2]}` : undefined;
}
