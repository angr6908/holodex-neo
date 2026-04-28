import { Button } from "@/components/ui/Button";

type TlExportButtonsProps = {
  onExportSrt: () => void;
  onExportAss: () => void;
  onExportTtml: () => void;
};

export function TlExportButtons({ onExportSrt, onExportAss, onExportTtml }: TlExportButtonsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button type="button" onClick={onExportSrt}>.srt</Button>
      <Button type="button" onClick={onExportAss}>.ass</Button>
      <Button type="button" onClick={onExportTtml}>.ttml</Button>
    </div>
  );
}
