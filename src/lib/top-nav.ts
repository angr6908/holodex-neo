// Pages that fill the screen without the top nav. The boot script (app/layout), MainNav and
// pull-to-refresh all read this, so the nav's height variables and the pull indicator tucked under
// the nav agree on where the nav is.
export const NO_TOP_NAV_PATHS = ["/multiview", "/tlclient", "/scripteditor"] as const;

export function hasTopNav(pathname: string) {
  return !NO_TOP_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// The same test for the boot script, which runs before any module loads.
export const NO_TOP_NAV_PATTERN = `^(${NO_TOP_NAV_PATHS.join("|")})(/|$)`;
