import type { CONFIG } from "./config";

export type BrowserApp = (typeof CONFIG.supportedBrowsers)[number];
export type CaptureType = "screenshot" | "clipboard" | "selection";

export interface CaptureInput {
  selectedText?: string | null;
  screenshotPath?: string | null;
  activeViewContent?: string | null;
}

export interface CaptureContext {
  app: string | null;
  bundleId: string | null;
  url: string | null;
  window: string | null;
  favicon: string | null;
  title: string | null;
}

export interface CapturedData extends CaptureContext {
  id: string;
  type: CaptureType;
  timestamp: string;
  selectedText: string | null;
  screenshotPath: string | null;
  activeViewContent: string | null;
  comment?: string;
}
