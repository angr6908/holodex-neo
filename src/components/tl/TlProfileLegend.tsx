import { Kbd } from "@/components/ui/kbd";

// The profile switcher legend shown while typing TLs: one row per profile with its shortcut.
export function TlProfileLegend({
  profiles,
  activeIndex,
  showNextTab = false,
}: {
  profiles: Array<{ id?: string; Name: string }>;
  activeIndex: number;
  /** Also mark the profile that Tab switches to next. */
  showNextTab?: boolean;
}) {
  const nextTabIndex = Math.max(1, (activeIndex + 1) % profiles.length);
  return profiles.map((profile, index) => (
    <span key={profile.id} className={index === activeIndex ? "font-medium text-primary" : ""}>
      {index === activeIndex ? "> " : ""}
      {index > 0 ? <Kbd>Ctrl-{index}</Kbd> : null}
      {index === 0 ? <Kbd>Ctrl-{index} | Shift⇧-Tab↹</Kbd> : null}
      {showNextTab && index === nextTabIndex ? <Kbd className="ml-1">Tab↹</Kbd> : null}
      {` ${profile.Name}`}
    </span>
  ));
}
