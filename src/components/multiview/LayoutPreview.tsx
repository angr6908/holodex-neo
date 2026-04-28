"use client";

import { useAppState } from "@/lib/store";

function px(num: number) { return `${num * (100 / 24)}%`; }

export function LayoutPreview({ layout = [], content = {}, mobile = false, scale = 1 }: { layout?: any[]; content?: Record<string, any>; mobile?: boolean; scale?: number }) {
  const app = useAppState();
  const isLightTheme = !app.settings.darkMode;
  const width = scale * (mobile ? 108 : 192);
  const height = scale * (mobile ? 192 : 108);
  const palette = isLightTheme ? {
    info: "rgba(56, 189, 248, 0.28)",
    warning: "rgba(251, 191, 36, 0.3)",
  } : {
    info: "rgba(56, 189, 248, 0.24)",
    warning: "rgba(251, 191, 36, 0.28)",
  };
  return (
    <div className={`layout-preview ${isLightTheme ? "theme--light" : ""}`} style={{ width, height }}>
      {layout.map((item) => {
        const isChat = content?.[item.i]?.type === "chat";
        return (
          <div key={item.i} className="layout-preview-cell" style={{ top: px(item.y), left: px(item.x), width: px(item.w), height: px(item.h), backgroundColor: isChat ? palette.warning : palette.info }}>
            {isChat ? <span>💬</span> : null}
          </div>
        );
      })}
    </div>
  );
}
