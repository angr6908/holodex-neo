type CVPair = { channelId: string; videoId: string };

export function replayTimedContinuation(
  origin: CVPair,
  { top = false, seekMs = 0 }: { top?: boolean; seekMs?: number } = {},
): string {
  const chatType = top ? 4 : 1;
  const payload = ld(156074452, [
    ld(3, hdt(origin)),
    vt(8, 1),
    ld(11, vt(2, seekMs)),
    ld(14, vt(1, chatType)),
    vt(15, 1),
  ]);
  return encodeURIComponent(u8tob64(payload));
}

const u8tob64 = (data: Uint8Array) =>
  globalThis.btoa
    ? globalThis.btoa(String.fromCharCode.apply(null, data as any))
    : (Buffer as any).from(data).toString("base64");

function ld(fid: bigint | number, payload: Uint8Array[] | Uint8Array | string): Uint8Array {
  const b =
    typeof payload === "string"
      ? new TextEncoder().encode(payload)
      : Array.isArray(payload)
        ? concatu8(payload)
        : payload;
  return concatu8([bitou8(pbh(fid, 2)), bitou8(encv(BigInt(b.byteLength))), b]);
}

function vt(fid: bigint | number, payload: bigint | number): Uint8Array {
  return concatu8([bitou8(pbh(fid, 0)), bitou8(payload)]);
}

const pbh = (fid: bigint | number, type: number) => encv((BigInt(fid) << 3n) | BigInt(type));

function bitou8(n: bigint | number): Uint8Array {
  let hv = n.toString(16);
  if (hv.length % 2) hv = `0${hv}`;
  const out = new Uint8Array(hv.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hv.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concatu8(args: Uint8Array[]): Uint8Array {
  const total = args.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of args) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function encv(n: bigint): bigint {
  let s = 0n;
  while (n >> 7n) {
    s = (s << 8n) | 0x80n | (n & 0x7fn);
    n >>= 7n;
  }
  return (s << 8n) | n;
}

function hdt(tgt: CVPair): string {
  return u8tob64(
    concatu8([
      ld(1, ld(5, [ld(1, tgt.channelId), ld(2, tgt.videoId)])),
      ld(3, ld(48687757, ld(1, tgt.videoId))),
      vt(4, 1),
    ]),
  );
}
