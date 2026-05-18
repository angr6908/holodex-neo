"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { checkIOS } from "@/lib/functions";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { cn } from "@/lib/utils";
export type MessageRendererHandle = { scrollToBottom: () => void };

const fontSizeClasses: Record<number, string> = {
  10: "text-[10px]",
  11: "text-[11px]",
  12: "text-xs",
  13: "text-[13px]",
  14: "text-sm",
  15: "text-[15px]",
  16: "text-base",
  17: "text-[17px]",
  18: "text-lg",
  19: "text-[19px]",
  20: "text-xl",
  21: "text-[21px]",
  22: "text-[22px]",
  23: "text-[23px]",
  24: "text-2xl",
};

export function liveTlFontSizeClass(fontSize = 14) {
  return fontSizeClasses[Math.round(fontSize)] || "text-sm";
}

export const MessageRenderer = forwardRef<MessageRendererHandle, { tlHistory?: any[]; fontSize?: number; children?: React.ReactNode }>(function MessageRenderer({ tlHistory = [], fontSize = 14, children }, ref) {
  const tlBody = useRef<HTMLDivElement | null>(null);
  const hideAuthor = (item: any, index: number) => index > 0 && index < tlHistory.length - 1 && item.name === tlHistory[index - 1].name && !item.breakpoint;
  const scrollToBottom = () => { if (tlBody.current && Math.abs(tlBody.current.scrollTop / tlBody.current.scrollHeight) <= 0.15) tlBody.current.scrollTop = 0; };
  useImperativeHandle(ref, () => ({ scrollToBottom }));
  const iosClass = checkIOS() ? "scale-y-[-1] !flex-col" : "";
  return (
    <div ref={tlBody} className={cn("flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain p-1 leading-[1.35] tracking-[0.018em] lg:p-3", liveTlFontSizeClass(fontSize), iosClass)}>
      <div className={iosClass}>
        {tlHistory.map((item, index) => (
          <ChatMessage key={item.key || `${item.name}-${item.timestamp}-${index}`} source={item} hideAuthor={hideAuthor(item, index)} />
        ))}
      </div>
      <div className={`text-center ${iosClass}`}>
        {children}
      </div>
    </div>
  );
});

export function WatchSubtitleOverlay({ messages = [] }: { messages?: any[] }) {
  return (
    <div className="absolute bottom-[min(48px,10%)] ml-[5%] flex w-[90%] justify-center">
      <span className="text-center">
        {messages.map((msg: any) => (
          <div key={msg.id || msg.key || `${msg.name}-${msg.timestamp}-${msg.message}`} className="text-center">
            {!msg.is_tl ? <div className={`mb-[-0.3rem] text-[max(1vw,20px)] ${msg.is_owner ? "text-primary" : "text-muted-foreground"}`}><span className="bg-background px-2">{msg.name} :</span></div> : null}
            {msg.parsed ? <span className="whitespace-pre-wrap break-words bg-background px-2 text-foreground" dangerouslySetInnerHTML={{ __html: msg.parsed }} /> : <span className="whitespace-pre-wrap break-words bg-background px-2 text-foreground">{msg.message}</span>}
          </div>
        ))}
      </span>
    </div>
  );
}
