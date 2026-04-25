import linkifyHtml from "linkifyjs/html";

export function vueLinkifyHtml(input: string) {
  return linkifyHtml(String(input ?? ""));
}
