"use client";

import { mdiVideoPlus } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CellControl } from "@/components/multiview/CellControl";
import { useI18n } from "@/lib/i18n";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import * as icons from "@/lib/icons";

export function EmptyCell({ item, onDelete, onShowSelector, onSetChat }: { item: any; onDelete?: (id: string) => void; onShowSelector?: (id: string) => void; onSetChat?: (id: string, initAsTL: boolean) => void }) {
  const { t } = useI18n();
  const store = useOptionalMultiviewStore();
  const setItemAsChat = (initAsTL: boolean) => { if (store) store.setLayoutContentById({ id: item.i, content: { type: "chat", initAsTL } }); onSetChat?.(item.i, initAsTL); };
  return (
    <div className="cell-content pt-4">
      <div className="centered-btn">
        <Button type="button" className="w-[190px] bg-indigo-600 text-white hover:brightness-110" size="lg" onClick={() => onShowSelector?.(item.i)}><Icon icon={mdiVideoPlus} />{t("views.multiview.video.selectLive")}</Button>
        <div className="mt-2 flex max-w-[190px] gap-2">
          <Button type="button" size="lg" className="flex-1 bg-teal-600 text-white hover:brightness-110" onClick={() => setItemAsChat(false)}><Icon icon={icons.ytChat} />Chat</Button>
          <Button type="button" size="lg" className="flex-1 bg-teal-600 text-white hover:brightness-110" onClick={() => setItemAsChat(true)}><Icon icon={icons.tlChat} />TL</Button>
        </div>
      </div>
      <CellControl playIcon={icons.mdiPlay} className="mx-1 mb-2" onDelete={() => onDelete?.(item.i)} />
    </div>
  );
}
