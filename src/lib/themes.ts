import { readJSON } from "@/lib/browser";
function createTheme({ name, id, color, lightBackground = "#f2f2f2", darkBackground = "#121212" }: { name: string; id: number; color: string; lightBackground?: string; darkBackground?: string }) {
  return { name, id, themes: { dark: { background: darkBackground, accent: color }, light: { background: lightBackground, accent: color } } };
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
  ["ときのそら", "Sora", "#1352f5"], ["夜空メル", "Mel", "#ffcf0e"], ["湊あくあ", "Aqua", "#ff82e1"],
  ["白上フブキ", "Fubuki", "#65d3f5"], ["ロボ子さん", "Roboco", "#925a8a"], ["アキ・ローゼンタール", "Aki", "#ee1090"],
  ["紫咲シオン", "Shion", "#9c60d6"], ["大神ミオ", "Mio", "#ee2540"], ["さくらみこ", "Miko", "#ff7494"],
  ["赤井はあと", "Haato", "#eb0c35"], ["百鬼あやめ", "Ayame", "#dc2e45"], ["猫又おかゆ", "Okayu", "#d171f3"],
  ["星街すいせい", "Suisei", "#3fd9ef"], ["癒月ちょこ", "Choco", "#ee6291"], ["戌神ころね", "Korone", "#eec01f"],
  ["AZKi", "AZKi", "#e32881"], ["夏色まつり", "Matsuri", "#ff7c17"], ["大空スバル", "Subaru", "#cff322"],
  ["兎田ぺこら", "Pekora", "#77c6f5"], ["天音かなた", "Kanata", "#88ccf5"], ["雪花ラミィ", "Lamy", "#5ac1ee"],
  ["ラプラス・ダークネス", "Laplus", "#6c40ae"], ["潤羽るしあ", "Rushia", "#1fedc8"], ["桐生ココ", "Coco", "#ed7f0b"],
  ["桃鈴ねね", "Nene", "#ff9836"], ["鷹嶺ルイ", "Lui", "#560d2f"], ["不知火フレア", "Flare", "#ee441e"],
  ["角巻わため", "Watame", "#ede694"], ["獅白ぼたん", "Botan", "#81dabb"], ["博衣こより", "Koyori", "#ff8ac0"],
  ["白銀ノエル", "Noel", "#9b9fa8"], ["常闇トワ", "Towa", "#b9aef5"], ["魔乃アロエ", "Aloe", "#ee7bb6"],
  ["沙花叉クロヱ", "Chloe", "#bd2d2b"], ["宝鐘マリン", "Marine", "#b9301e"], ["姫森ルーナ", "Luna", "#ed78b8"],
  ["尾丸ポルカ", "Polka", "#bd181c"], ["風真いろは", "Iroha", "#6ccec8"], ["Ayunda Risu", "Ayunda", "#f39f9e"],
  ["Kureiji Ollie", "Kureiji", "#c70931"], ["Vestia Zeta", "Vestia", "#a9adb9"], ["Moona Hoshinova", "Moona", "#9575cd"],
  ["Anya Melfissa", "Anya", "#edb336"], ["Kaela Kovalskia", "Kaela", "#ee3133"], ["Airani Iofifteen", "Airani", "#97e732"],
  ["Pavolia Reine", "Pavolia", "#0a319d"], ["Kobo Kanaeru", "Kobo", "#28285a"], ["Mori Calliope", "Mori", "#b50826"],
  ["IRyS", "IRyS", "#bd1056"], ["Tsukumo Sana", "Tsukumo", "#de9fbf"], ["Shiori Novella", "Shiori", "#a290be"],
  ["Takanashi Kiara", "Takanashi", "#ee4512"], ["Ceres Fauna", "Ceres", "#74d797"], ["Koseki Bijou", "Koseki", "#5d4fea"],
  ["Ninomae Ina'nis", "Ninomae", "#514a74"], ["Ouro Kronii", "Ouro", "#4348af"], ["Nerissa Ravencroft", "Nerissa", "#202dd4"],
  ["Gawr Gura", "Gawr", "#4c75bd"], ["Nanashi Mumei", "Nanashi", "#cfac92"], ["Fuwawa Abyssgard", "Fuwawa", "#4a9dfb"],
  ["Watson Amelia", "Watson", "#f5cc64"], ["Hakos Baelz", "Hakos", "#ff675d"], ["Mococo Abyssgard", "Mococo", "#fb94ca"],
  ["Elizabeth Rose Bloodflame", "Elizabeth", "#af343b"], ["Gigi Murin", "Gigi", "#e5a434"], ["Cecilia Immergreen", "Cecilia", "#128a4f"],
  ["Raora Panthera", "Raora", "#ec6f98"], ["火威青", "Ao", "#1a2d59"], ["響咲リオナ", "Riona", "#e42d6b"],
  ["音乃瀬奏", "Kanade", "#fbd78c"], ["虎金妃笑虎", "Niko", "#f46f14"], ["一条莉々華", "Ririka", "#f1699a"],
  ["水宮枢", "Su", "#6bd9f2"], ["儒烏風亭らでん", "Raden", "#2c6d60"], ["輪堂千速", "Chihaya", "#32a3a3"],
  ["轟はじめ", "Hajime", "#a4a6ff"], ["綺々羅々ヴィヴィ", "Vivi", "#f36db4"],
] as const;

const DEFAULT_THEME_ID = MEMBERS.length;
const defaultTheme = createTheme({ name: "Default", id: DEFAULT_THEME_ID, color: "#38bdf8", lightBackground: "#f5f7fb", darkBackground: "#121212" });

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

export default themeSet;
