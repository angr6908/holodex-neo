"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { checkIOS } from "@/lib/functions";
import { ChatMessage } from "@/components/chat/ChatMessage";
export type MessageRendererHandle = { scrollToBottom: () => void };

export const MessageRenderer = forwardRef<MessageRendererHandle, { tlHistory?: any[]; fontSize?: number; children?: React.ReactNode }>(function MessageRenderer({ tlHistory = [], fontSize = 14, children }, ref) {
  const tlBody = useRef<HTMLDivElement | null>(null);
  const hideAuthor = (item: any, index: number) => index > 0 && index < tlHistory.length - 1 && item.name === tlHistory[index - 1].name && !item.breakpoint;
  const scrollToBottom = () => { if (tlBody.current && Math.abs(tlBody.current.scrollTop / tlBody.current.scrollHeight) <= 0.15) tlBody.current.scrollTop = 0; };
  useImperativeHandle(ref, () => ({ scrollToBottom }));
  const iosClass = checkIOS() ? "scale-y-[-1] !flex-col" : "";
  return (
    <div ref={tlBody} className={`flex h-[calc(100%-32px)] flex-col-reverse overflow-y-auto overscroll-contain p-1 leading-[1.35] tracking-[0.018em] lg:p-3 ${iosClass}`} style={{ fontSize: `${fontSize}px` }}>
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
            {!msg.is_tl ? <div className={`mb-[-0.3rem] text-[max(1vw,20px)] ${msg.is_owner ? "text-[color:var(--color-primary)]" : "text-slate-400"}`}><span className="bg-black/75 px-2">{msg.name} :</span></div> : null}
            {msg.parsed ? <span className="whitespace-pre-wrap break-words bg-black/75 text-white shadow-[10px_0_0_rgba(0,0,0,0.75),-10px_0_0_rgba(0,0,0,0.75)]" dangerouslySetInnerHTML={{ __html: msg.parsed }} /> : <span className="whitespace-pre-wrap break-words bg-black/75 text-white shadow-[10px_0_0_rgba(0,0,0,0.75),-10px_0_0_rgba(0,0,0,0.75)]">{msg.message}</span>}
          </div>
        ))}
      </span>
    </div>
  );
}
