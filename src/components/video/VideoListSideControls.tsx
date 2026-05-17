"use client";

import { TL_LANGS } from "@/lib/consts";
import { HOME_TABS } from "@/lib/cookie-codec";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { type AnyIcon } from "@/lib/icons";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VideoListFilters } from "@/components/setting/VideoListFilters";
import { useTranslations } from "next-intl";
export function VideoListSideControls({
  tab,
  isActive,
  sortBy,
  displayIcon: DisplayIcon,
  toDate,
  clipLangs,
  onSortByChange,
  onToggleDisplayMode,
  onToDateChange,
  onToggleClipLang,
}: {
  tab: number;
  isActive: boolean;
  sortBy: string;
  displayIcon: AnyIcon;
  toDate: string | null;
  clipLangs: string[];
  onSortByChange: (value: string) => void;
  onToggleDisplayMode: () => void;
  onToDateChange: (value: string | null) => void;
	  onToggleClipLang: (value: string, checked: boolean) => void;
	}) {
  const t = useTranslations();

	  return (
	    <>
      <div className="absolute top-0 right-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleDisplayMode}
        >
          <DisplayIcon className="size-5" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
	        {tab === HOME_TABS.LIVE_UPCOMING ? (
	          <div className="flex flex-col gap-[0.45rem]">
	            <span className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">{t("views.home.controls.sortBy")}</span>
	            <ToggleGroup
	              variant="outline"
	              size="sm"
	              value={[sortBy]}
	              onValueChange={(value) => value[0] && onSortByChange(value[0])}
	            >
	              <ToggleGroupItem value="viewers">{t("views.home.controls.viewers")}</ToggleGroupItem>
	              <ToggleGroupItem value="latest">{t("views.home.controls.latest")}</ToggleGroupItem>
	            </ToggleGroup>
	          </div>
	        ) : null}
	        {tab !== HOME_TABS.LIVE_UPCOMING && isActive ? (
	          <div className="flex flex-col items-start gap-[0.45rem]">
	            <span className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">{t("views.home.controls.uploadedBefore")}</span>
	            <DatePicker
	              value={toDate ?? ""}
	              placeholder={t("views.home.controls.pickDate")}
	              onChange={(value) => onToDateChange(value || null)}
	            />
	          </div>
	        ) : null}
	        {tab === HOME_TABS.CLIPS && isActive ? (
	          <div className="flex min-h-0 flex-1 flex-col gap-[0.45rem]">
	            <span className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">{t("views.home.controls.clipLanguages")}</span>
            <div className="flex flex-wrap items-start gap-2">
              {TL_LANGS.map((lang) => (
                <Toggle
                  key={`${lang.value}-clip`}
                  pressed={clipLangs.includes(lang.value)}
                  variant="outline"
                  className="min-w-fit flex-1 justify-start"
                  aria-label={lang.text}
                  onPressedChange={(pressed) =>
                    onToggleClipLang(lang.value, pressed)
                  }
                >
                  <span className="truncate">{lang.text}</span>
                </Toggle>
              ))}
            </div>
          </div>
        ) : null}
        {tab !== HOME_TABS.CLIPS ? (
          <VideoListFilters
            className="min-h-0 flex-1"
            showDescriptions={false}
            compact
          />
        ) : null}
      </div>
    </>
  );
}
