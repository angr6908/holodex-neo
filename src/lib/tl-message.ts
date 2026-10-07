// YouTube emoji in TL messages arrive as "<shortcode>https://<image url>" and are shown as images.
const EMOJI_URL =
  /(\S+)(https:\/\/(yt\d+\.ggpht\.com\/[a-zA-Z0-9_\-=/]+-c-k-nd|www\.youtube\.com\/[a-zA-Z0-9_\-=/]+\.svg))/gi;

export type TlMessagePart =
  | { start: number; text: string }
  | { start: number; emoji: string; shortcode: string };

// Splits a TL message into text and emoji parts (`start` is the offset, unique per message).
// Messages with links also show any "<...>" as "(...)", as they always have.
export function tlMessageParts(message: string): TlMessagePart[] {
  const raw = String(message ?? "");
  if (!raw.includes("https://")) return [{ start: 0, text: raw }];
  const text = raw.replace(/<([^>]*)>/g, "($1)");
  const parts: TlMessagePart[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI_URL)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ start: last, text: text.slice(last, start) });
    parts.push({ start, emoji: match[2], shortcode: match[1] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ start: last, text: text.slice(last) });
  return parts;
}
