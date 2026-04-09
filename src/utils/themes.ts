export const DEFAULT_THEME_ID = 23;

const DEFAULT_LIGHT_BG = "#f5f7fb";
const DEFAULT_DARK_BG = "#121212";
const MEMBER_LIGHT_BG = "#f2f2f2";
const MEMBER_DARK_BG = "#121212";

function createTheme({
  name,
  id,
  color,
  lightBackground = MEMBER_LIGHT_BG,
  darkBackground = MEMBER_DARK_BG,
}) {
  return {
    name,
    id,
    themes: {
      dark: {
        background: darkBackground,
        accent: color,
      },
      light: {
        background: lightBackground,
        accent: color,
      },
    },
  };
}

// Source:
// https://seesaawiki.jp/hololivetv/d/%a5%db%a5%ed%a5%e9%a5%a4%a5%d6#hololive-JP
// JP/ID/EN/DEV_IS talent pages, including listed graduates/original members.
// Color rule: midpoint of the two "公式サイトでのタレント背景色" values.
// Fallbacks:
// - 大神ミオ uses page "イメージカラー" first two rows.
// - 魔乃アロエ is overridden by portrait hair color from:
//   https://hololive.wiki/wiki/File:Mano_Aloe_-_Portrait_01.png
const OFFICIAL_MEMBER_THEMES = [
  { sourceName: "ときのそら", name: "Sora", color: "#1352f5" },
  { sourceName: "夜空メル", name: "Mel", color: "#ffcf0e" },
  { sourceName: "湊あくあ", name: "Aqua", color: "#ff82e1" },
  { sourceName: "白上フブキ", name: "Fubuki", color: "#65d3f5" },
  { sourceName: "ロボ子さん", name: "Roboco", color: "#925a8a" },
  { sourceName: "アキ・ローゼンタール", name: "Aki", color: "#ee1090" },
  { sourceName: "紫咲シオン", name: "Shion", color: "#9c60d6" },
  { sourceName: "大神ミオ", name: "Mio", color: "#ee2540" },
  { sourceName: "さくらみこ", name: "Miko", color: "#ff7494" },
  { sourceName: "赤井はあと", name: "Haato", color: "#eb0c35" },
  { sourceName: "百鬼あやめ", name: "Ayame", color: "#dc2e45" },
  { sourceName: "猫又おかゆ", name: "Okayu", color: "#d171f3" },
  { sourceName: "星街すいせい", name: "Suisei", color: "#3fd9ef" },
  { sourceName: "癒月ちょこ", name: "Choco", color: "#ee6291" },
  { sourceName: "戌神ころね", name: "Korone", color: "#eec01f" },
  { sourceName: "AZKi", name: "AZKi", color: "#e32881" },
  { sourceName: "夏色まつり", name: "Matsuri", color: "#ff7c17" },
  { sourceName: "大空スバル", name: "Subaru", color: "#cff322" },
  { sourceName: "兎田ぺこら", name: "Pekora", color: "#77c6f5" },
  { sourceName: "天音かなた", name: "Kanata", color: "#88ccf5" },
  { sourceName: "雪花ラミィ", name: "Lamy", color: "#5ac1ee" },
  { sourceName: "ラプラス・ダークネス", name: "Laplus", color: "#6c40ae" },
  { sourceName: "潤羽るしあ", name: "Rushia", color: "#1fedc8" },
  { sourceName: "桐生ココ", name: "Coco", color: "#ed7f0b" },
  { sourceName: "桃鈴ねね", name: "Nene", color: "#ff9836" },
  { sourceName: "鷹嶺ルイ", name: "Lui", color: "#560d2f" },
  { sourceName: "不知火フレア", name: "Flare", color: "#ee441e" },
  { sourceName: "角巻わため", name: "Watame", color: "#ede694" },
  { sourceName: "獅白ぼたん", name: "Botan", color: "#81dabb" },
  { sourceName: "博衣こより", name: "Koyori", color: "#ff8ac0" },
  { sourceName: "白銀ノエル", name: "Noel", color: "#9b9fa8" },
  { sourceName: "常闇トワ", name: "Towa", color: "#b9aef5" },
  { sourceName: "魔乃アロエ", name: "Aloe", color: "#ee7bb6" },
  { sourceName: "沙花叉クロヱ", name: "Chloe", color: "#bd2d2b" },
  { sourceName: "宝鐘マリン", name: "Marine", color: "#b9301e" },
  { sourceName: "姫森ルーナ", name: "Luna", color: "#ed78b8" },
  { sourceName: "尾丸ポルカ", name: "Polka", color: "#bd181c" },
  { sourceName: "風真いろは", name: "Iroha", color: "#6ccec8" },
  { sourceName: "Ayunda Risu", name: "Ayunda", color: "#f39f9e" },
  { sourceName: "Kureiji Ollie", name: "Kureiji", color: "#c70931" },
  { sourceName: "Vestia Zeta", name: "Vestia", color: "#a9adb9" },
  { sourceName: "Moona Hoshinova", name: "Moona", color: "#9575cd" },
  { sourceName: "Anya Melfissa", name: "Anya", color: "#edb336" },
  { sourceName: "Kaela Kovalskia", name: "Kaela", color: "#ee3133" },
  { sourceName: "Airani Iofifteen", name: "Airani", color: "#97e732" },
  { sourceName: "Pavolia Reine", name: "Pavolia", color: "#0a319d" },
  { sourceName: "Kobo Kanaeru", name: "Kobo", color: "#28285a" },
  { sourceName: "Mori Calliope", name: "Mori", color: "#b50826" },
  { sourceName: "IRyS", name: "IRyS", color: "#bd1056" },
  { sourceName: "Tsukumo Sana", name: "Tsukumo", color: "#de9fbf" },
  { sourceName: "Shiori Novella", name: "Shiori", color: "#a290be" },
  { sourceName: "Takanashi Kiara", name: "Takanashi", color: "#ee4512" },
  { sourceName: "Ceres Fauna", name: "Ceres", color: "#74d797" },
  { sourceName: "Koseki Bijou", name: "Koseki", color: "#5d4fea" },
  { sourceName: "Ninomae Ina'nis", name: "Ninomae", color: "#514a74" },
  { sourceName: "Ouro Kronii", name: "Ouro", color: "#4348af" },
  { sourceName: "Nerissa Ravencroft", name: "Nerissa", color: "#202dd4" },
  { sourceName: "Gawr Gura", name: "Gawr", color: "#4c75bd" },
  { sourceName: "Nanashi Mumei", name: "Nanashi", color: "#cfac92" },
  { sourceName: "Fuwawa Abyssgard", name: "Fuwawa", color: "#4a9dfb" },
  { sourceName: "Watson Amelia", name: "Watson", color: "#f5cc64" },
  { sourceName: "Hakos Baelz", name: "Hakos", color: "#ff675d" },
  { sourceName: "Mococo Abyssgard", name: "Mococo", color: "#fb94ca" },
  { sourceName: "Elizabeth Rose Bloodflame", name: "Elizabeth", color: "#af343b" },
  { sourceName: "Gigi Murin", name: "Gigi", color: "#e5a434" },
  { sourceName: "Cecilia Immergreen", name: "Cecilia", color: "#128a4f" },
  { sourceName: "Raora Panthera", name: "Raora", color: "#ec6f98" },
  { sourceName: "火威青", name: "Ao", color: "#1a2d59" },
  { sourceName: "響咲リオナ", name: "Riona", color: "#e42d6b" },
  { sourceName: "音乃瀬奏", name: "Kanade", color: "#fbd78c" },
  { sourceName: "虎金妃笑虎", name: "Niko", color: "#f46f14" },
  { sourceName: "一条莉々華", name: "Ririka", color: "#f1699a" },
  { sourceName: "水宮枢", name: "Su", color: "#6bd9f2" },
  { sourceName: "儒烏風亭らでん", name: "Raden", color: "#2c6d60" },
  { sourceName: "輪堂千速", name: "Chihaya", color: "#32a3a3" },
  { sourceName: "轟はじめ", name: "Hajime", color: "#a4a6ff" },
  { sourceName: "綺々羅々ヴィヴィ", name: "Vivi", color: "#f36db4" },
];

const memberColorMap = new Map(
  OFFICIAL_MEMBER_THEMES.map((item) => [item.sourceName, item.color]),
);

function getMemberColor(sourceName, fallback = "#8fb5b7") {
  return memberColorMap.get(sourceName) || fallback;
}

const legacyThemes = [
  { sourceName: "湊あくあ", name: "Aqua", id: 0, color: getMemberColor("湊あくあ") },
  { sourceName: "夏色まつり", name: "Matsuri", id: 1, color: getMemberColor("夏色まつり") },
  { sourceName: "戌神ころね", name: "Korone", id: 2, color: getMemberColor("戌神ころね") },
  { sourceName: "潤羽るしあ", name: "Rushia", id: 3, color: getMemberColor("潤羽るしあ") },
  { sourceName: "白上フブキ", name: "Fubuki", id: 4, color: getMemberColor("白上フブキ") },
  // Kept for backward compatibility with existing stored theme id usage.
  { sourceName: null, name: "Figaro", id: 5, color: "#8fb5b7" },
  { sourceName: "紫咲シオン", name: "Shion", id: 6, color: getMemberColor("紫咲シオン") },
  { sourceName: "桐生ココ", name: "Coco", id: 7, color: getMemberColor("桐生ココ") },
  { sourceName: "星街すいせい", name: "Suisei", id: 8, color: getMemberColor("星街すいせい") },
  { sourceName: "赤井はあと", name: "Haato", id: 9, color: getMemberColor("赤井はあと") },
  { sourceName: "さくらみこ", name: "Miko", id: 10, color: getMemberColor("さくらみこ") },
  { sourceName: "IRyS", name: "IRyS", id: 11, color: getMemberColor("IRyS") },
  { sourceName: "姫森ルーナ", name: "Luna", id: 12, color: getMemberColor("姫森ルーナ") },
  { sourceName: "兎田ぺこら", name: "Pekora", id: 13, color: getMemberColor("兎田ぺこら") },
  { sourceName: "尾丸ポルカ", name: "Polka", id: 14, color: getMemberColor("尾丸ポルカ") },
  { sourceName: "常闇トワ", name: "Towa", id: 15, color: getMemberColor("常闇トワ") },
  { sourceName: "不知火フレア", name: "Flare", id: 16, color: getMemberColor("不知火フレア") },
  { sourceName: "白銀ノエル", name: "Noel", id: 17, color: getMemberColor("白銀ノエル") },
  { sourceName: "雪花ラミィ", name: "Lamy", id: 18, color: getMemberColor("雪花ラミィ") },
  { sourceName: "猫又おかゆ", name: "Okayu", id: 19, color: getMemberColor("猫又おかゆ") },
  { sourceName: "Kobo Kanaeru", name: "Kobo", id: 20, color: getMemberColor("Kobo Kanaeru") },
  { sourceName: "Ceres Fauna", name: "Ceres", id: 21, color: getMemberColor("Ceres Fauna") },
  { sourceName: "Pavolia Reine", name: "Pavolia", id: 22, color: getMemberColor("Pavolia Reine") },
];

const legacySourceNameSet = new Set(
  legacyThemes.map((item) => item.sourceName).filter(Boolean),
);

const fullMemberThemes = OFFICIAL_MEMBER_THEMES
  .filter((item) => !legacySourceNameSet.has(item.sourceName))
  .map((item, index) => createTheme({ name: item.name, id: 24 + index, color: item.color }));

const defaultTheme = createTheme({
  name: "Default",
  id: DEFAULT_THEME_ID,
  color: "#38bdf8",
  lightBackground: DEFAULT_LIGHT_BG,
  darkBackground: DEFAULT_DARK_BG,
});

const sortThemesByName = (a, b) => a.name.localeCompare(b.name, "en", {
  sensitivity: "base",
  numeric: true,
});

const themeSet = [
  defaultTheme,
  ...legacyThemes.map((item) => createTheme(item)),
  ...fullMemberThemes,
].sort(sortThemesByName);

export function resolveThemeById(themeId) {
  const numericId = Number(themeId);
  return themeSet.find((item) => item.id === numericId) || defaultTheme;
}

export function readStoredThemeId() {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_ID;
  const raw = localStorage.getItem("theme");
  if (raw === null || raw === "") return DEFAULT_THEME_ID;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_THEME_ID;
}

export default themeSet;
