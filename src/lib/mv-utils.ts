export type LayoutItem = { i: string; x: number; y: number; w: number; h: number; [key: string]: any };

export interface Content {
  id?: string;
  type: string;
  isTwitch?: boolean;
  video?: any;
  currentTab?: number;
  currentTime?: number;
  editMode?: boolean;
  muted?: boolean;
  volume?: number;
  playbackRate?: number;
  initAsTL?: boolean;
}

const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";
export const sortLayout = (a, b) => a.x - b.x || a.y - b.y;

export const generateContentId = () => Array.from({ length: 8 }, () => b64[Math.floor(Math.random() * b64.length)]).join("");

export function encodeLayout({ layout, contents, includeVideo = false }) {
  try {
    const parts: string[] = [];
    for (const i of layout) {
      if (i.x >= 64 || i.y >= 64 || i.w >= 64 || i.h >= 64) continue;
      let b = b64[i.x] + b64[i.y] + b64[i.w] + b64[i.h];
      const c = contents[i.i];
      if (c) {
        if (c.type === "chat") b += `chat${c.currentTab || 0}`;
        else if (c.type === "video" && includeVideo) b += c.video?.type === "twitch" ? `twitch${c.id}` : c.id;
      }
      parts.push(b);
    }
    return parts.join(",");
  } catch (e) { console.error(e); return "error"; }
}

export function decodeLayout(encoded) {
  const layout: LayoutItem[] = [];
  const content: Record<number, Content> = {};
  let videoCellCount = 0;
  const parts = encoded.split(",");
  parts.sort(); // DO NOT TOUCH THIS LINE
  parts.forEach((s) => {
    const idx = generateContentId();
    const code = s.substring(4, 15);
    let isVideoCell = true;
    const item: LayoutItem = {
      x: b64.indexOf(s[0]), y: b64.indexOf(s[1]), w: b64.indexOf(s[2]), h: b64.indexOf(s[3]),
      i: idx, isDraggable: true, isResizable: true, moved: false,
    };
    if (code.startsWith("chat")) {
      isVideoCell = false;
      const tab = code.length === 5 ? Number(code[4]) : -1;
      content[idx] = { type: "chat", ...(tab >= 0 && { currentTab: tab }) };
    } else if (code.startsWith("twitch")) {
      const tw = s.substring(10);
      content[idx] = { type: "video", id: tw, video: { id: tw, type: "twitch", channel: { name: tw } } };
    } else if (code.length === 11) {
      const name = s.substring(15);
      content[idx] = { type: "video", id: code, video: { id: code, channel: { name: name || code } } };
    }
    if (isVideoCell) videoCellCount++;
    layout.push(item);
  });
  return { id: encoded, layout, content, videoCellCount };
}

export const desktopPresets = Object.freeze([
  { layout: "AAYY", name: "1🎞️" },
  { layout: "AATY,TAFYchat0", name: "Side Chat 1", default: 1 },
  { layout: "AAMY,MAMY", name: "2🎞️", default: 2 },
  { layout: "AARM,AMRM,RAHYchat", name: "Side Chat 2" },
  { layout: "AAOM,AMOM,OAFYchat,TAFYchat", name: "2🎞️, 2💬" },
  { layout: "AAMY,MAMM,MMMM", name: "1🎞️+2", default: 3 },
  { layout: "AAMM,AMMM,MAMM,MMGMchat,SMGMchat", name: "3🎞️, 2💬" },
  { layout: "AAMM,AMMM,MAMM,MMMM", name: "2x2🎞️" },
  { layout: "AAKM,KAKM,UAEMchat0,AMKM,KMKM,UMEMchat0", name: "2x2🎞️ 2💬", default: 4 },
  { layout: "PAJM,AAJM,AMJM,PMJM,JADMchat0,JMDMchat0,MADMchat0,MMDMchat0", name: "2x2🎞️ 4💬" },
  { layout: "SAGYchat,AAJM,AMJM,JAJM,JMJM", name: "2x2🎞️ 1💬" },
  { layout: "AAMP,APIJ,IPIJ,MAMP,QPIJ", name: "5🎞️", default: 5 },
  { layout: "AAIM,AMIM,IAIM,QMIM,QAIM,MMEMchat0,IMEMchat0", name: "5🎞️ 2💬", default: 5 },
  { layout: "AAIM,AMIM,IAIM,IMIM,QAIM,QMIM", name: "2x3🎞️", default: 6 },
  { layout: "AAQQ,AQII,IQII,QAII,QIII,QQII", name: "p1s5" },
  { layout: "AAJM,AMJM,JAJM,JMJM,SAGI,SIGI,SQGI", name: "7🎞️", default: 7 },
  { layout: "AAKM,AMKM,RAHI,KAHI,RQHI,KQHI,KIHI,RIHI", name: "8🎞️", default: 8 },
  { layout: "AAII,AIII,AQII,IAII,IIII,IQII,QAII,QIII,QQII", name: "3 x 3🎞️", default: 9 },
  { layout: "AAGI,GAGI,MAGI,AIGI,GIGI,MIGI,AQGI,GQGI,MQGI,SAGYchat", name: "3x3🎞️ 1💬" },
  { layout: "AAHI,AQHI,AIHI,HAHI,HIHI,HQHI,OAHI,OIHI,OQHI,VIDIchat0,VADIchat0,VQDIchat0", name: "3x3🎞️ 3💬" },
  { layout: "AAML,MAML,ALGH,GLGH,MLGH,SLGH,ASGG,GSGG,MSGG,SSGG", name: "Among Us 1", default: 10 },
  { layout: "AAKL,KAKL,UAEYchat,ALFH,FLFH,KLFH,PLFH,ASFG,FSFG,KSFG,PSFG", name: "Among Us 2" },
  { layout: "AASR,SAGYchat,ARGH,GRGH,MRGH", name: "Sports Fes 1" },
  { layout: "AAMM,SAGYchat,AMGG,ASGG,GMGG,GSGG,MAGG,MGGG,MMGG,MSGG", name: "Sports Fes 2" },
  { layout: "GAMM,GMMM,AAGG,AGGG,AMGG,ASGG,SAGG,SGGG,SMGG,SSGG", name: "Sports Fes 3" },
  { layout: "AAIK,IAIK,QAIK,AKGH,GKGH,MKGH,SKGH,SRGH,ARGH,MRGH,GRGH", name: "Among Us 3", default: 11 },
  { layout: "AAGI,GAGI,MAGI,AIGI,GIGI,MIGI,SIGI,SQGI,AQGI,MQGI,GQGI,SAGI", name: "4x3", default: 12 },
  { layout: "AAMM,MMGG,AMGG,GMGG,MGGG,SSGG,MSGG,MAGG,SMGG,SGGG,SAGG,ASGG,GSGG", name: "13🎞️", default: 13 },
  { layout: "AMJM,OMFG,OGFG,TGFG,JMFG,AAJM,OAFG,TMFG,JAFG,TSFG,OSFG,JGFG,TAFG,JSFG", name: "14🎞️", default: 14 },
  { layout: "AGGG,MMGG,MGGG,SGGG,GMGG,AAGG,MAGG,SMGG,GAGG,SSGG,MSGG,GGGG,SAGG,GSGG,AMGG,ASGG", name: "4x4", default: 16 },
  { layout: "AAHY,HAHY,OAFYchat,TAFYchat", name: "2📱 2💬" },
  { layout: "AAGY,GAGY,MAGY,SAGYchat", name: "3📱 1💬" },
  { layout: "AAMM,AMMM,MAHY,TAFYchat2", name: "2🎞️ 1📱 1💬" },
]);

export const mobilePresets = Object.freeze([
  { layout: "AAYI,AIYQchat0", name: "Mobile 1", emptyCells: 1, portrait: true },
  { layout: "AOYKchat,AAYH,AHYH", name: "Mobile 2", emptyCells: 2, portrait: true },
  { layout: "AAYI,AIYI,AQYI", name: "Mobile 3", emptyCells: 3, portrait: true },
  { layout: "MAMY,AAMM,AMMM", name: "Mobile 3L" },
  { layout: "AAMM,AMMM,MAMM,MMMM", name: "Mobile 4", emptyCells: 4 },
]);

export function getDesktopDefaults() {
  const defaults: string[] = [];
  for (const p of desktopPresets) if (p.default) defaults[p.default] = p.layout;
  return defaults;
}
