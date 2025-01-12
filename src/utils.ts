import {
  BrowserExtension,
  getFrontmostApplication,
  showToast as raycastShowToast,
  Toast,
  getPreferenceValues,
  closeMainWindow,
  popToRoot,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { v4 as uuidv4 } from "uuid";

interface Preferences {
  screenshotsDirectory: string;
  captureDirectory: string;
}

// Configuration
export const CONFIG = {
  directories: {
    captures: getPreferenceValues<Preferences>().captureDirectory.replace("~", os.homedir()),
    screenshots: getPreferenceValues<Preferences>().screenshotsDirectory.replace("~", os.homedir()),
  },
  supportedBrowsers: ["Arc", "Brave", "Chrome", "Safari", "Firefox", "Orion"] as const,
} as const;

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
  favicon?: string | null;
  title?: string | null;
}

export interface CapturedData extends Required<CaptureContext> {
  id: string;
  type: CaptureType;
  timestamp: string;
  selectedText: string | null;
  screenshotPath: string | null;
  activeViewContent: string | null;
  comment?: string;
}

// Services
export const FileService = {
  async ensureDirectory(dir: string) {
    console.debug("Ensuring directory exists:", dir);
    try {
      await fs.mkdir(dir, { recursive: true });
      console.debug("Directory ready:", dir);
    } catch (error) {
      console.error("Failed to create directory:", dir, error);
      throw error;
    }
  },

  async saveJSON(filePath: string, data: unknown) {
    console.debug("Saving JSON to:", filePath);
    const dir = path.dirname(filePath);
    await this.ensureDirectory(dir);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.debug("Saved JSON successfully");
  },

  getTimestampedPath(base: string, name: string, ext: string) {
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filePath = path.join(base, `${name}-${timestamp}.${ext}`);
    console.debug("Generated timestamped path:", filePath);
    return filePath;
  },

  async captureScreenshot(saveDir: string, timestamp: string): Promise<string | null> {
    try {
      await this.ensureDirectory(saveDir);
      const outputPath = path.join(saveDir, `screenshot-${timestamp}.png`);
      console.debug("Capturing screenshot to:", outputPath);
      const script = `do shell script "screencapture -x '${outputPath}'"`;
      await runAppleScript(script);

      try {
        await fs.access(outputPath);
        console.debug("Screenshot saved successfully");
        return outputPath;
      } catch {
        console.debug("Screenshot file not found after capture");
        return null;
      }
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      return null;
    }
  },
};

export const CaptureManager = {
  async save(data: CapturedData) {
    console.debug("Saving capture data:", JSON.stringify(data, null, 2));
    const filePath = FileService.getTimestampedPath(CONFIG.directories.captures, data.type, "json");
    console.debug("Saving to path:", filePath);
    await FileService.ensureDirectory(CONFIG.directories.captures);
    await FileService.saveJSON(filePath, data);
    return filePath;
  },

  async load(directory: string) {
    console.debug("Loading captures from directory:", directory);
    await FileService.ensureDirectory(directory);

    const files = await fs.readdir(directory);
    console.debug("Found files:", files);

    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    console.debug("Filtered JSON files:", jsonFiles);

    const captures = await Promise.all(
      jsonFiles.map(async (f) => {
        const filePath = path.join(directory, f);
        console.debug("Reading file:", filePath);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          console.debug("Raw file content:", content);
          const data = JSON.parse(content) as CapturedData;
          console.debug("Parsed data:", data);

          if (!data.id || !data.timestamp || !data.type) {
            console.debug("Skipping invalid capture:", data);
            return null;
          }

          return {
            path: filePath,
            data,
            timestamp: new Date(data.timestamp),
          };
        } catch (error) {
          console.error("Failed to load capture:", filePath, error);
          return null;
        }
      }),
    );

    const validCaptures = captures.filter((c): c is NonNullable<typeof c> => c !== null);
    console.debug("Valid captures:", validCaptures);

    return validCaptures.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },
};

export const WindowService = {
  async getActiveAppInfo(): Promise<CaptureContext> {
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

    const tabInfo = CONFIG.supportedBrowsers.includes(appName as BrowserApp)
      ? await BrowserService.getActiveTabInfo(appName)
      : { url: null, title: null, favicon: null };

    return {
      app: appName,
      bundleId,
      url: tabInfo.url,
      window: frontMostApp.name,
      title: tabInfo.title,
      favicon: tabInfo.favicon,
    };
  },
};

export const BrowserService = {
  async getActiveTabInfo(
    appName: string | null,
  ): Promise<{ url: string | null; title: string | null; favicon: string | null }> {
    if (!appName || !CONFIG.supportedBrowsers.includes(appName as BrowserApp)) {
      return { url: null, title: null, favicon: null };
    }

    try {
      console.debug("Getting tabs for browser:", appName);
      const tabs = await BrowserExtension.getTabs();
      console.debug("Got tabs:", JSON.stringify(tabs, null, 2));

      // Get all active tabs
      const activeTabs = tabs.filter((tab) => tab.active);
      console.debug("Active tabs:", activeTabs);

      // If multiple active tabs, try to match with the current window title
      if (activeTabs.length > 1) {
        const script = `
          tell application "${appName}"
            return title of active tab of front window
          end tell
        `;
        try {
          const currentTitle = await runAppleScript(script);
          console.debug("Current window title:", currentTitle);
          const matchingTab = activeTabs.find((tab) => tab.title === currentTitle);
          if (matchingTab) {
            return {
              url: matchingTab.url,
              title: matchingTab.title,
              favicon: matchingTab.favicon ?? null,
            };
          }
        } catch (error) {
          console.debug("Failed to get current window title:", error);
        }
      }

      // Fallback to first active tab
      const activeTab = activeTabs[0];
      return {
        url: activeTab?.url ?? null,
        title: activeTab?.title ?? null,
        favicon: activeTab?.favicon ?? null,
      };
    } catch (error) {
      console.debug(`Failed to get tab info for ${appName}:`, error);
      return { url: null, title: null, favicon: null };
    }
  },

  async getActiveTabURL(appName: string | null) {
    return (await this.getActiveTabInfo(appName)).url;
  },

  async getActiveTabHTML(appName: string | null): Promise<string | null> {
    if (!appName || !CONFIG.supportedBrowsers.includes(appName as BrowserApp)) return null;

    try {
      const content = await BrowserExtension.getContent({ format: "markdown" });
      if (content) {
        console.debug("Got content length:", content.length);
      }
      return content;
    } catch (error) {
      // Silently handle content capture failures (PDFs, etc)
      console.debug(`Content capture not available for ${appName}`);
      return null;
    }
  },
};

export const ToastService = {
  async showCapturing() {
    return raycastShowToast({ style: Toast.Style.Animated, title: "Capturing context..." });
  },

  async showSuccess(message?: string) {
    return raycastShowToast({
      style: Toast.Style.Success,
      title: "Context Captured",
      message: message ?? "⌘K to add a comment",
    });
  },

  async showError(error: unknown) {
    console.error("Capture failed:", error);
    return raycastShowToast({
      style: Toast.Style.Failure,
      title: "Capture Failed",
      message: String(error),
    });
  },
};

export const CaptureService = {
  async createCapture(type: CaptureType, getData: () => Promise<CaptureInput>) {
    const timestamp = new Date().toISOString();
    const data = await getData();
    const context = await WindowService.getActiveAppInfo();
    const browserContent = CONFIG.supportedBrowsers.includes(context.app as BrowserApp)
      ? await BrowserService.getActiveTabHTML(context.app)
      : null;

    return {
      id: uuidv4(),
      type,
      timestamp,
      selectedText: data.selectedText ?? null,
      screenshotPath: data.screenshotPath ?? null,
      activeViewContent: data.activeViewContent ?? browserContent,
      ...context,
    };
  },

  async capture(
    type: CaptureType,
    getData: () => Promise<CaptureInput>,
    validate?: (data: CaptureInput) => boolean | string,
  ) {
    try {
      await ToastService.showCapturing();

      // Get data
      const data = await getData();
      console.debug("Raw capture data:", data);

      // Validate if needed
      if (validate) {
        const validationResult = validate(data);
        if (validationResult !== true) {
          throw new Error(typeof validationResult === "string" ? validationResult : "Validation failed");
        }
      }

      // Create and save capture
      const captureData = await this.createCapture(type, async () => data);
      console.debug("Created capture data:", JSON.stringify(captureData, null, 2));
      await CaptureManager.save(captureData);

      await ToastService.showSuccess();
      await closeMainWindow();
      await popToRoot();
    } catch (error) {
      console.error("Capture failed:", error);
      await ToastService.showError(error);
    }
  },
};
