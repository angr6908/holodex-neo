export const HOME_STATE_COOKIE = "holodex-neo-home";

export type HomeUiState = {
  viewMode?: "streams" | "channels";
  isFavPage?: boolean;
  tab?: number;
  scrollY?: number;
};

export function encodeHomeState(value: HomeUiState) {
  try {
    return encodeURIComponent(JSON.stringify(value));
  } catch {
    return "";
  }
}

export function decodeHomeState(value?: string | null): HomeUiState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
