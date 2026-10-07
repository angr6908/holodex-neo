import { Fragment } from "react";
import { tlMessageParts } from "@/lib/tl-message";

// A TL message's text, with YouTube emoji shown as images.
export function TlMessageText({ message }: { message: string }) {
  return tlMessageParts(message).map((part) =>
    "emoji" in part ? (
      <img key={part.start} src={part.emoji} alt={part.shortcode} />
    ) : (
      <Fragment key={part.start}>{part.text}</Fragment>
    ),
  );
}
