export function channelAvatarSizeClass(size: string | number | undefined) {
  const px = Number(size) || 40;
  const classes: Record<number, string> = {
    24: "size-6",
    28: "size-7",
    32: "size-8",
    36: "size-9",
    40: "size-10",
    42: "size-[42px]",
    48: "size-12",
    52: "size-[52px]",
    55: "size-[55px]",
    56: "size-14",
    60: "size-[60px]",
    72: "size-[72px]",
  };
  return classes[px] || "size-10";
}
