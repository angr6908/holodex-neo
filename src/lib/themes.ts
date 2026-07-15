import { readJSON } from "@/lib/browser";

export const LEGACY_THEME_COLOR = "#42a5f5";

// Hex → OKLCH conversion following the standard IEC 61966-2-1 / Oklab pipeline.
function hexToOklch(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lr = lin(r),
    lg = lin(g),
    lb = lin(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bk * bk);
  const H = ((Math.atan2(bk, a) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/**
 * Build the complete shadcn CSS variable block for both light and dark mode,
 * derived from a single brand hex colour.
 *
 * Two deliberate design choices vs the plain shadcn reference:
 *
 * 1. PROPORTIONAL TINTING — neutral tints are computed as a fraction of the
 *    brand chroma (C), not as fixed constants.  A near-grey brand colour like
 *    Noel (#9b9fa8, C≈0.01) produces barely-visible tints so the app stays
 *    neutral.  A vivid colour like Sora (#1352f5, C≈0.25) casts its hue
 *    across backgrounds, cards, and surfaces so the whole app *feels* themed.
 *
 * 2. HIGHER-SPECIFICITY SELECTORS — we target :root[data-theme] / .dark[data-theme]
 *    (specificity 0-2-0) instead of bare :root / .dark (0-1-0).  This beats
 *    the globals.css fallback rules regardless of stylesheet injection order,
 *    including Next.js dev-mode HMR re-injections.
 *
 * Tokens intentionally left out (inherit globals.css fallbacks):
 *   --radius, --destructive, --chart-1…5
 */
export function buildThemeCss(hex: string): string {
  const [L, C, H] = hexToOklch(hex);
  const f = (l: number, c: number) => `oklch(${l.toFixed(3)} ${c.toFixed(4)} ${H.toFixed(1)})`;

  // Proportional tints: each role gets a fraction of brand chroma, capped so
  // even the most saturated colours never look garish.
  const tc = (frac: number, cap: number) => Math.min(C * frac, cap);
  const surfT = tc(0.15, 0.045); // dark: bg, card, popover, sidebar
  const subT = tc(0.12, 0.036); // dark: secondary / muted / accent panel
  const fgT = tc(0.1, 0.025); // both: foreground text
  const mutFgT = tc(0.25, 0.06); // both: muted-foreground (labels)
  const bdrT = tc(0.1, 0.028); // light: border, input
  const secLT = tc(0.07, 0.02); // light: secondary / muted / accent panel
  const sidLT = tc(0.05, 0.015); // light: sidebar background

  // Primary – lightness clamped to readable ranges; chroma + hue unchanged.
  const lp = f(Math.max(0.28, Math.min(0.5, L)), C);
  const dp = f(Math.max(0.62, Math.min(0.82, L + 0.28)), C);

  const light = [
    `--background:oklch(1 0 0)`,
    `--foreground:${f(0.145, fgT)}`,
    `--card:oklch(1 0 0)`,
    `--card-foreground:${f(0.145, fgT)}`,
    `--popover:oklch(1 0 0)`,
    `--popover-foreground:${f(0.145, fgT)}`,
    `--primary:${lp}`,
    `--primary-foreground:oklch(0.985 0 0)`,
    `--secondary:${f(0.97, secLT)}`,
    `--secondary-foreground:${f(0.205, fgT)}`,
    `--muted:${f(0.97, secLT)}`,
    `--muted-foreground:${f(0.556, mutFgT)}`,
    `--accent:${f(0.97, secLT)}`,
    `--accent-foreground:${f(0.205, fgT)}`,
    `--border:${f(0.922, bdrT)}`,
    `--input:${f(0.922, bdrT)}`,
    `--ring:${lp}`,
    `--sidebar:${f(0.985, sidLT)}`,
    `--sidebar-foreground:${f(0.145, fgT)}`,
    `--sidebar-primary:${lp}`,
    `--sidebar-primary-foreground:oklch(0.985 0 0)`,
    `--sidebar-accent:${f(0.97, secLT)}`,
    `--sidebar-accent-foreground:${f(0.205, fgT)}`,
    `--sidebar-border:${f(0.922, bdrT)}`,
    `--sidebar-ring:${lp}`,
  ].join(";");

  const dark = [
    `--background:${f(0.145, surfT)}`,
    `--foreground:${f(0.985, fgT)}`,
    `--card:${f(0.205, surfT)}`,
    `--card-foreground:${f(0.985, fgT)}`,
    `--popover:${f(0.205, surfT)}`,
    `--popover-foreground:${f(0.985, fgT)}`,
    `--primary:${dp}`,
    `--primary-foreground:oklch(0.145 0 0)`,
    `--secondary:${f(0.269, subT)}`,
    `--secondary-foreground:${f(0.985, fgT)}`,
    `--muted:${f(0.269, subT)}`,
    `--muted-foreground:${f(0.708, mutFgT)}`,
    `--accent:${f(0.269, subT)}`,
    `--accent-foreground:${f(0.985, fgT)}`,
    `--border:oklch(1 0 0 / 10%)`,
    `--input:oklch(1 0 0 / 15%)`,
    `--ring:${dp}`,
    `--sidebar:${f(0.205, surfT)}`,
    `--sidebar-foreground:${f(0.985, fgT)}`,
    `--sidebar-primary:${dp}`,
    `--sidebar-primary-foreground:oklch(0.145 0 0)`,
    `--sidebar-accent:${f(0.269, subT)}`,
    `--sidebar-accent-foreground:${f(0.985, fgT)}`,
    `--sidebar-border:oklch(1 0 0 / 10%)`,
    `--sidebar-ring:${dp}`,
  ].join(";");

  // Use attribute-qualified selectors (specificity 0-2-0) so these rules
  // always beat the plain :root / .dark blocks in globals.css (0-1-0).
  return `:root[data-theme]{${light}}.dark[data-theme]{${dark}}`;
}

/** Inject (or update) a <style id="holodex-theme-vars"> element in <head>. */
export function applyThemeColor(hex: string) {
  if (typeof document === "undefined") return;
  const css = buildThemeCss(hex);
  let el = document.getElementById("holodex-theme-vars") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "holodex-theme-vars";
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function createTheme({ name, id, color }: { name: string; id: number; color: string }) {
  return { name, id, computedColor: color };
}

// Source:
// https://seesaawiki.jp/hololivetv/d/%a5%db%a5%ed%a5%e9%a5%a4%a5%d6#hololive-JP
// JP/ID/EN/DEV_IS talent pages, including listed graduates/original members.
// Color rule: midpoint of the two "公式サイトでのタレント背景色" values.
// Fallbacks:
// - 大神ミオ uses page "イメージカラー" first two rows.
// - 魔乃アロエ is overridden by portrait hair color from:
//   https://hololive.wiki/wiki/File:Mano_Aloe_-_Portrait_01.png
const MEMBERS = [
  ["ときのそら", "Sora", "#1352f5"],
  ["夜空メル", "Mel", "#ffcf0e"],
  ["湊あくあ", "Aqua", "#ff82e1"],
  ["白上フブキ", "Fubuki", "#65d3f5"],
  ["ロボ子さん", "Roboco", "#925a8a"],
  ["アキ・ローゼンタール", "Aki", "#ee1090"],
  ["紫咲シオン", "Shion", "#9c60d6"],
  ["大神ミオ", "Mio", "#ee2540"],
  ["さくらみこ", "Miko", "#ff7494"],
  ["赤井はあと", "Haato", "#eb0c35"],
  ["百鬼あやめ", "Ayame", "#dc2e45"],
  ["猫又おかゆ", "Okayu", "#d171f3"],
  ["星街すいせい", "Suisei", "#3fd9ef"],
  ["癒月ちょこ", "Choco", "#ee6291"],
  ["戌神ころね", "Korone", "#eec01f"],
  ["AZKi", "AZKi", "#e32881"],
  ["夏色まつり", "Matsuri", "#ff7c17"],
  ["大空スバル", "Subaru", "#cff322"],
  ["兎田ぺこら", "Pekora", "#77c6f5"],
  ["天音かなた", "Kanata", "#88ccf5"],
  ["雪花ラミィ", "Lamy", "#5ac1ee"],
  ["ラプラス・ダークネス", "Laplus", "#6c40ae"],
  ["潤羽るしあ", "Rushia", "#1fedc8"],
  ["桐生ココ", "Coco", "#ed7f0b"],
  ["桃鈴ねね", "Nene", "#ff9836"],
  ["鷹嶺ルイ", "Lui", "#560d2f"],
  ["不知火フレア", "Flare", "#ee441e"],
  ["角巻わため", "Watame", "#ede694"],
  ["獅白ぼたん", "Botan", "#81dabb"],
  ["博衣こより", "Koyori", "#ff8ac0"],
  ["白銀ノエル", "Noel", "#9b9fa8"],
  ["常闇トワ", "Towa", "#b9aef5"],
  ["魔乃アロエ", "Aloe", "#ee7bb6"],
  ["沙花叉クロヱ", "Chloe", "#bd2d2b"],
  ["宝鐘マリン", "Marine", "#b9301e"],
  ["姫森ルーナ", "Luna", "#ed78b8"],
  ["尾丸ポルカ", "Polka", "#bd181c"],
  ["風真いろは", "Iroha", "#6ccec8"],
  ["Ayunda Risu", "Ayunda", "#f39f9e"],
  ["Kureiji Ollie", "Kureiji", "#c70931"],
  ["Vestia Zeta", "Vestia", "#a9adb9"],
  ["Moona Hoshinova", "Moona", "#9575cd"],
  ["Anya Melfissa", "Anya", "#edb336"],
  ["Kaela Kovalskia", "Kaela", "#ee3133"],
  ["Airani Iofifteen", "Airani", "#97e732"],
  ["Pavolia Reine", "Pavolia", "#0a319d"],
  ["Kobo Kanaeru", "Kobo", "#28285a"],
  ["Mori Calliope", "Mori", "#b50826"],
  ["IRyS", "IRyS", "#bd1056"],
  ["Tsukumo Sana", "Tsukumo", "#de9fbf"],
  ["Shiori Novella", "Shiori", "#a290be"],
  ["Takanashi Kiara", "Takanashi", "#ee4512"],
  ["Ceres Fauna", "Ceres", "#74d797"],
  ["Koseki Bijou", "Koseki", "#5d4fea"],
  ["Ninomae Ina'nis", "Ninomae", "#514a74"],
  ["Ouro Kronii", "Ouro", "#4348af"],
  ["Nerissa Ravencroft", "Nerissa", "#202dd4"],
  ["Gawr Gura", "Gawr", "#4c75bd"],
  ["Nanashi Mumei", "Nanashi", "#cfac92"],
  ["Fuwawa Abyssgard", "Fuwawa", "#4a9dfb"],
  ["Watson Amelia", "Watson", "#f5cc64"],
  ["Hakos Baelz", "Hakos", "#ff675d"],
  ["Mococo Abyssgard", "Mococo", "#fb94ca"],
  ["Elizabeth Rose Bloodflame", "Elizabeth", "#af343b"],
  ["Gigi Murin", "Gigi", "#e5a434"],
  ["Cecilia Immergreen", "Cecilia", "#128a4f"],
  ["Raora Panthera", "Raora", "#ec6f98"],
  ["火威青", "Ao", "#1a2d59"],
  ["響咲リオナ", "Riona", "#e42d6b"],
  ["音乃瀬奏", "Kanade", "#fbd78c"],
  ["虎金妃笑虎", "Niko", "#f46f14"],
  ["一条莉々華", "Ririka", "#f1699a"],
  ["水宮枢", "Su", "#6bd9f2"],
  ["儒烏風亭らでん", "Raden", "#2c6d60"],
  ["輪堂千速", "Chihaya", "#32a3a3"],
  ["轟はじめ", "Hajime", "#a4a6ff"],
  ["綺々羅々ヴィヴィ", "Vivi", "#f36db4"],
] as const;

const DEFAULT_THEME_ID = MEMBERS.length;
const defaultTheme = createTheme({ name: "Default", id: DEFAULT_THEME_ID, color: "#38bdf8" });

const themeSet = [
  ...MEMBERS.map(([, name, color], id) => createTheme({ name, id, color })),
  defaultTheme,
].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }));

export function resolveThemeById(themeId: number | string) {
  return themeSet.find((item) => item.id === Number(themeId)) || defaultTheme;
}

export function readStoredThemeId() {
  const parsed = Number(readJSON("theme", DEFAULT_THEME_ID));
  return Number.isFinite(parsed) ? parsed : DEFAULT_THEME_ID;
}

export function getComputedThemeColor(themeId: number | string = readStoredThemeId()) {
  return resolveThemeById(themeId).computedColor || LEGACY_THEME_COLOR;
}

export default themeSet;
