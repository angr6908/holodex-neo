const fontSizeClasses: Record<number, string> = {
  10: "text-[10px]",
  11: "text-[11px]",
  12: "text-xs",
  13: "text-[13px]",
  14: "text-sm",
  15: "text-[15px]",
  16: "text-base",
  17: "text-[17px]",
  18: "text-lg",
  19: "text-[19px]",
  20: "text-xl",
  21: "text-[21px]",
  22: "text-[22px]",
  23: "text-[23px]",
  24: "text-2xl",
};

export function liveTlFontSizeClass(fontSize = 14) {
  return fontSizeClasses[Math.round(fontSize)] || "text-sm";
}
