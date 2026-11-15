/** Split HTTP links from message text without treating trailing punctuation as part of the URL. */
export function splitChatLinks(text: string): { text: string; url?: string }[] {
  const result: { text: string; url?: string }[] = [];
  const pattern = /https?:\/\/[^\s<>]+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const url = match[0].replace(/[.,!?;:]+$/, "");
    if (start > last) result.push({ text: text.slice(last, start) });
    if (url) result.push({ text: url, url });
    last = start + url.length;
  }
  if (last < text.length) result.push({ text: text.slice(last) });
  return result;
}
