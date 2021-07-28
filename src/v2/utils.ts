import { App, ContentItem, ContentItemVersion } from "./types";

export function isApp(a: any | App): a is App {
  return (a as App).token !== undefined;
}

export function isContentItem(f: any | ContentItem): f is ContentItem {
  return (f as ContentItem).uuid !== undefined;
}

export function isContentVersion(f: any | ContentItemVersion): f is ContentItemVersion {
  return (f as ContentItemVersion).url !== undefined;
}