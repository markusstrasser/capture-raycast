import {
  BrowserExtension,
  getFrontmostApplication,
  showToast as raycastShowToast,
  Toast,
  getPreferenceValues,
  closeMainWindow,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { v4 as uuidv4 } from "uuid";

// Types
export type CaptureType = "screenshot" | "clipboard" | "selection";
export type BrowserApp = (typeof CONFIG.supportedBrowsers)[number];

export interface CaptureContext {
  app: string | null;
  bundleId: string | null;
  url: string | null;
  windowTitle: string | null;
  pageTitle: string | null;
}

export interface CapturedData extends Required<Omit<CaptureContext, "pageTitle">> {
  id: string;
  type: CaptureType;
  timestamp: string;
  content: string | null;
  screenshotUrl: string | null;
  pageContent: string | null;
  comment?: string;
  pageTitle: string | null;
}

interface TabInfo {
  url: string | null;
  title: string | null;
}

// Configuration
export const CONFIG = {
  directories: {
    captures: getPreferenceValues<{ captureDirectory: string }>().captureDirectory.replace("~", os.homedir()),
    screenshots: getPreferenceValues<{ screenshotsDirectory: string }>().screenshotsDirectory.replace(
      "~",
      os.homedir(),
    ),
  },
  supportedBrowsers: ["Arc", "Brave", "Chrome", "Safari", "Firefox", "Orion"] as const,
} as const;

// Core utilities
export const utils = {
  async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error("Failed to create directory:", { dir, error });
      throw error;
    }
  },

  getTimestampedPath(base: string, name: string, ext: string): string {
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    return path.join(base, `${name}-${timestamp}.${ext}`);
  },

  async saveJSON(filePath: string, data: unknown): Promise<void> {
    await utils.ensureDirectory(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  },

  async loadCaptures(directory: string) {
    await utils.ensureDirectory(directory);
    const allFiles = await fs.readdir(directory);
    const jsonFiles = allFiles.filter((f) => f.endsWith(".json"));

    const captures = await Promise.all(
      jsonFiles.map(async (f) => {
        const filePath = path.join(directory, f);
        try {
          const data = JSON.parse(await fs.readFile(filePath, "utf-8")) as CapturedData;
          return data.id && data.timestamp && data.type
            ? { path: filePath, data, timestamp: new Date(data.timestamp) }
            : null;
        } catch (error) {
          console.error("Failed to load capture:", { filePath, error });
          return null;
        }
      }),
    );

    return captures
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },

  isImageFile: (f: string) => !f.startsWith(".") && /\.(png|gif|mp4|jpg|jpeg|webp|heic)$/i.test(f),

  getFileUrl: (filePath: string) => `file://${filePath}`,
  stripFileProtocol: (url: string) => url.replace(/^file:\/\//, ""),

  sanitizeTimestamp: (timestamp: string) => timestamp.replace(/:/g, "-"),

  isSupportedBrowser: (appName: string | null): appName is BrowserApp =>
    Boolean(appName && CONFIG.supportedBrowsers.includes(appName as BrowserApp)),

  isValidUrl: (url: string | null | undefined): url is string => {
    if (!url) return false;
    // Filter out special URL schemes and browser-specific URLs
    const invalidSchemes = [
      "mailto:",
      "about:",
      "chrome:",
      "edge:",
      "safari:",
      "firefox:",
      "brave:",
      "file:",
      "tel:",
      "data:",
    ];
    return !invalidSchemes.some((scheme) => url.toLowerCase().startsWith(scheme));
  },

  async getActiveTabInfo(appName: string | null): Promise<TabInfo> {
    if (!utils.isSupportedBrowser(appName)) {
      return { url: null, title: null };
    }

    try {
      const tabs = await BrowserExtension.getTabs();

      // Get the window ID of the frontmost window
      const script = `
        tell application "${appName}"
          set windowTitle to title of front window
          set tabTitle to title of active tab of front window
          return {windowTitle, tabTitle}
        end tell
      `;

      try {
        const { windowTitle, tabTitle } = await runAppleScript(script).then((result) => {
          const [windowTitle, tabTitle] = result.split(",");
          return { windowTitle: windowTitle?.trim(), tabTitle: tabTitle?.trim() };
        });

        // First try to find the exact match using window title and tab title
        const matchingTab = tabs.find((tab) => tab.active && tab.title === tabTitle);

        if (matchingTab) {
          return {
            url: utils.isValidUrl(matchingTab.url) ? matchingTab.url : null,
            title: matchingTab.title ?? null,
          };
        }

        // Fallback: try to find just by tab title
        const tabByTitle = tabs.find((tab) => tab.active && tab.title === tabTitle);

        if (tabByTitle) {
          return {
            url: utils.isValidUrl(tabByTitle.url) ? tabByTitle.url : null,
            title: tabByTitle.title ?? null,
          };
        }

        // Last resort: get the most recently active tab
        const activeTabs = tabs.filter((tab) => tab.active);
        const mostRecentTab = activeTabs[0];

        return {
          url: utils.isValidUrl(mostRecentTab?.url) ? mostRecentTab?.url : null,
          title: mostRecentTab?.title ?? null,
        };
      } catch (error) {
        console.debug("Failed to get window/tab info via AppleScript:", { error });
        // Fallback to basic active tab selection
        const activeTab = tabs.find((tab) => tab.active);
        return {
          url: utils.isValidUrl(activeTab?.url) ? activeTab?.url : null,
          title: activeTab?.title ?? null,
        };
      }
    } catch (error) {
      console.debug("Failed to get tab info:", { browser: appName, error });
      return { url: null, title: null };
    }
  },

  async getActiveTabContent(appName: string | null): Promise<string | null> {
    if (!utils.isSupportedBrowser(appName)) return null;
    try {
      return await BrowserExtension.getContent({ format: "markdown" });
    } catch (error) {
      console.debug("Failed to get tab content:", { browser: appName, error });
      return null;
    }
  },

  async getActiveWindowInfo(): Promise<CaptureContext> {
    const script = `
      tell application "System Events"
        set frontAppProcess to first application process whose frontmost is true
        set frontAppName to name of frontAppProcess
        set bundleID to id of frontAppProcess
        return frontAppName & "|||" & bundleID
      end tell
    `;
    const result = await runAppleScript(script);
    const [appName, bundleId] = result.trim().split("|||");
    const frontMostApp = await getFrontmostApplication();
    const tabInfo = await utils.getActiveTabInfo(appName);

    return {
      app: appName,
      bundleId,
      url: tabInfo.url,
      windowTitle: frontMostApp.name,
      pageTitle: tabInfo.title,
    };
  },

  async captureScreenshot(saveDir: string, timestamp: string): Promise<string | null> {
    try {
      await utils.ensureDirectory(saveDir);
      const outputPath = path.join(saveDir, `screenshot-${timestamp}.png`);
      await runAppleScript(`do shell script "screencapture -x '${outputPath}'"`);
      return outputPath;
    } catch (error) {
      console.error("Screenshot capture failed:", { error });
      return null;
    }
  },

  getCaptureMetadata(capture: CapturedData): Array<{ label: string; value: string }> {
    const base = [
      { label: "Type", value: capture.type },
      { label: "Timestamp", value: new Date(capture.timestamp).toLocaleString() },
      { label: "App", value: capture.app },
      { label: "Bundle ID", value: capture.bundleId },
      { label: "Window", value: capture.windowTitle },
    ];

    return [
      ...base.filter((item): item is { label: string; value: string } => Boolean(item.value)),
      ...(capture.content?.trim() ? [{ label: "Content", value: capture.content.trim() }] : []),
      ...(capture.comment ? [{ label: "Comment", value: capture.comment }] : []),
    ];
  },

  async showToast(options: { style: Toast.Style; title: string; message?: string }): Promise<Toast> {
    return raycastShowToast(options);
  },

  async handleComment(data: CapturedData, filePath: string, comment: string): Promise<void> {
    if (data.type === "screenshot" && filePath.startsWith(CONFIG.directories.screenshots)) {
      const timestamp = new Date().toISOString();
      const imagePath = path.join(CONFIG.directories.captures, `screenshot-${utils.sanitizeTimestamp(timestamp)}.png`);
      const jsonPath = path.join(CONFIG.directories.captures, `screenshot-${utils.sanitizeTimestamp(timestamp)}.json`);

      if (!data.screenshotUrl) {
        throw new Error("Screenshot URL is missing");
      }

      await utils.ensureDirectory(CONFIG.directories.captures);
      await fs.copyFile(utils.stripFileProtocol(data.screenshotUrl), imagePath);

      const captureData: CapturedData = {
        ...data,
        id: path.basename(jsonPath, ".json"),
        timestamp,
        screenshotUrl: utils.getFileUrl(imagePath),
        comment,
      };

      await utils.saveJSON(jsonPath, captureData);
    } else {
      const updatedData = { ...data, comment };
      await utils.saveJSON(filePath, updatedData);
    }
  },
};

// Simplified capture function
export async function createCapture(
  type: CaptureType,
  getData: () => Promise<{ content?: string | null; screenshotUrl?: string | null; comment?: string }>,
  validate?: (data: { content?: string | null; screenshotUrl?: string | null }) => boolean | string,
) {
  try {
    await utils.showToast({ style: Toast.Style.Animated, title: "Capturing context..." });

    // Run getData and getActiveWindowInfo in parallel
    const [data, context] = await Promise.all([getData(), utils.getActiveWindowInfo()]);

    console.debug("Raw capture data:", { data });

    if (validate) {
      const validationResult = validate(data);
      if (validationResult !== true) {
        throw new Error(typeof validationResult === "string" ? validationResult : "Validation failed");
      }
    }

    // Get browser content only if needed
    const browserContent = utils.isSupportedBrowser(context.app) ? await utils.getActiveTabContent(context.app) : null;

    const timestamp = new Date().toISOString();
    const captureData: CapturedData = {
      id: uuidv4(),
      type,
      timestamp,
      content: data.content ?? null,
      screenshotUrl: data.screenshotUrl ?? null,
      pageContent: browserContent,
      ...context,
      comment: data.comment ?? undefined, // Add comment from data
      pageTitle: context.pageTitle ?? null,
    };

    const filePath = utils.getTimestampedPath(CONFIG.directories.captures, type, "json");
    await utils.saveJSON(filePath, captureData);

    await utils.showToast({ style: Toast.Style.Success, title: "Captured!" });
    await closeMainWindow();
  } catch (error) {
    console.error("Capture failed:", error);
    await utils.showToast({
      style: Toast.Style.Failure,
      title: "Capture failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
