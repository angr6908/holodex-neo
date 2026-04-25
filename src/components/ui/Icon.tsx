import { cn } from "@/lib/cn";

const sizeMap: Record<string, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  default: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-7 w-7",
};

export function Icon({ icon = "", size = "default", className = "", title }: { icon?: string; size?: string; className?: string; title?: string }) {
  const iconClass = cn("inline-flex shrink-0 items-center justify-center", sizeMap[size] || sizeMap.default, className);
  const isPathIcon = typeof icon === "string" && icon.startsWith("M");
  if (isPathIcon) {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
        {title ? <title>{title}</title> : null}
        <path d={icon} />
      </svg>
    );
  }
  return <span className={iconClass} aria-hidden="true">{icon}</span>;
}
