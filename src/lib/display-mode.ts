// How a video list is laid out: one of three grid densities, a list or a dense list.
export type DisplayMode = "grid-0" | "grid-1" | "grid-2" | "list" | "denseList";

export const displayModeFor = (viewMode: string | undefined, gridSize: number): DisplayMode => {
  if (viewMode === "list") return "list";
  if (viewMode === "denseList") return "denseList";
  return `grid-${Math.min(Math.max(gridSize ?? 0, 0), 2)}` as DisplayMode;
};
