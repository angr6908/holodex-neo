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
  const iosClass = checkIOS() ? "ios-safari-reverse-fix" : "";
  return (
    <div ref={tlBody} className={`tl-body p-1 lg:p-3 ${iosClass}`} style={{ fontSize: `${fontSize}px` }}>
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
