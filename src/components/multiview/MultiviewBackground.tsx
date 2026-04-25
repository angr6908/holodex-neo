"use client";

import { mdiCardPlus, mdiFastForward, mdiTuneVertical } from "@mdi/js";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { reorderIcon } from "@/lib/mv-utils";
import * as icons from "@/lib/icons";

export function MultiviewBackground({ collapseToolbar = false, showTips = true, style }: { collapseToolbar?: boolean; showTips?: boolean; style?: React.CSSProperties }) {
  const { t } = useI18n();
  return (
    <div className="mv-background" style={style}>
      {showTips ? (
        <div className="mv-empty-state">
          <div className="mv-empty-card">
            <div className="mv-empty-lead">{collapseToolbar ? t("views.multiview.openToolbarTip") : t("views.multiview.autoLayoutTip")}</div>
            {!collapseToolbar ? <div className="mv-empty-sublead">{t("views.multiview.createLayoutTip")}</div> : null}
            <div className="mv-empty-divider" />
            <div className="hints">
              <div className="text-h4">{t("views.multiview.hints")}</div>
              <div className="hint-item">1. <Icon icon={icons.mdiGridLarge} size="sm" /> {t("views.multiview.presetsHint")}</div>
              <div className="hint-item">2. <Icon icon={mdiTuneVertical} size="sm" /> {t("views.multiview.mediaControlsHint1")} <Icon icon={mdiFastForward} size="sm" /> {t("views.multiview.mediaControlsHint2")}</div>
              <div className="hint-item">3. <Icon icon={mdiCardPlus} size="sm" /> {t("views.multiview.dragDropHint")}</div>
              <div className="hint-item">4. <Icon icon={reorderIcon} size="sm" /> {t("views.multiview.reorderHint")}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
