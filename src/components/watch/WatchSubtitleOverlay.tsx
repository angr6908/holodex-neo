"use client";

export function WatchSubtitleOverlay({ messages = [] }: { messages?: any[] }) {
  return (
    <div className="overlay flex justify-center">
      <span className="overlay-text">
        {messages.map((msg: any) => (
          <div key={msg.id || msg.key || `${msg.name}-${msg.timestamp}-${msg.message}`} className="text-center">
            {!msg.is_tl ? <div className={`subtitle-name ${msg.is_owner ? "text-[color:var(--color-primary)]" : "text-slate-400"}`}><span>{msg.name} :</span></div> : null}
            {msg.parsed ? <span className="subtitle-text" dangerouslySetInnerHTML={{ __html: msg.parsed }} /> : <span className="subtitle-text">{msg.message}</span>}
          </div>
        ))}
      </span>
    </div>
  );
}
