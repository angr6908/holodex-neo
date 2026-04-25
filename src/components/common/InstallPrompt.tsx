"use client";

import { useEffect, useMemo, useState } from "react";
import { mdiExportVariant } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { useAppState } from "@/lib/store";

function isAppleDevice() {
  if (typeof navigator === "undefined") return false;
  return ["iPhone", "iPad", "iPod"].includes(navigator.platform);
}
function isStandAlone() {
  if (typeof window === "undefined") return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
export function InstallPrompt() {
  const { t } = useI18n();
  const app = useAppState();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [iOSInstallDialog, setIOSInstallDialog] = useState(false);
  const [canDetectInstallPrompt, setCanDetectInstallPrompt] = useState(false);
  useEffect(() => {
    setCanDetectInstallPrompt(true);
    function beforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function appInstalled() {
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", beforeInstallPrompt);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallPrompt);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const showInstallPrompt = useMemo(() => {
    if (!canDetectInstallPrompt) return false;
    const promptWeekly =
      Date.now() - app.lastShownInstallPrompt > 1000 * 60 * 60 * 24 * 7;
    if (isAppleDevice() && !isStandAlone() && promptWeekly) return true;
    if (deferredPrompt && promptWeekly) return true;
    return false;
  }, [canDetectInstallPrompt, deferredPrompt, app.lastShownInstallPrompt]);

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else setIOSInstallDialog(true);
  }
  function hideInstallPrompt() {
    app.installPromptShown();
  }

  return (
    <div>
      {showInstallPrompt ? (
        <div className="fixed bottom-4 left-1/2 z-[120] w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-sky-400/30 bg-sky-500/20 p-4 text-white backdrop-blur">
          <div className="flex items-center">
            <img
              src="https://holodex.net/img/icons/apple-touch-icon-152x152.png"
              style={{ height: 40, width: 40, borderRadius: 6 }}
              alt=""
            />
            <div className="my-2 ml-2 text-caption">
              {t("component.installPrompt.callToAction")}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70"
              onClick={hideInstallPrompt}
            >
              {t("component.installPrompt.notNowBtn")}
            </Button>
            <Button variant="secondary" size="sm" onClick={install}>
              {t("component.installPrompt.installBtn")}
            </Button>
          </div>
        </div>
      ) : null}
      <Dialog
        open={iOSInstallDialog}
        className="max-w-[350px] p-0"
        onOpenChange={setIOSInstallDialog}
      >
        <Card className="py-4">
          <div style={{ textAlign: "center" }}>
            <div>
              <img
                src="https://holodex.net/img/icons/apple-touch-icon-152x152.png"
                style={{ height: 75, width: 75, borderRadius: 6 }}
                alt=""
              />
            </div>
            <div className="text-h5">
              {t("component.installPrompt.iOS.popup")}
            </div>
            <div className="my-2 h-px bg-white/10" />
            <div className="mt-3">
              {t("component.installPrompt.iOS.beforeExportIcon")}
              <Icon
                icon={mdiExportVariant}
                className="text-[color:var(--color-secondary)]"
              />
              {t("component.installPrompt.iOS.afterExportIcon")}
            </div>
          </div>
        </Card>
      </Dialog>
    </div>
  );
}
