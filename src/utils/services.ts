import {
  BrowserExtension,
  getFrontmostApplication,
  showToast as raycastShowToast,
  Toast,
  closeMainWindow,
  popToRoot,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "./config";
import type { BrowserApp, CaptureContext, CaptureInput, CapturedData, CaptureType } from "./types";
import { handleError } from "./errors";

interface CaptureData {
  id: string;
  type: string;
  timestamp: string;
  selectedText: string | null;
  screenshotPath: string;
  activeViewContent: string;
  title: string | null;
  favicon: string | null;
  url: string | null;
}

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
    const jsonString = JSON.stringify(data, null, 2);
    console.log("About to save JSON data:", jsonString);
    const dir = path.dirname(filePath);
    await this.ensureDirectory(dir);
    await fs.writeFile(filePath, jsonString);
    console.log("Saved JSON successfully");
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
    console.log("Raw data received:", data);

    // Double-check these fields in your logs
    console.log("Data fields:", data);

    // Ensure the final object includes them
    const cleanData = {
      id: data.id,
      type: data.type,
      timestamp: data.timestamp,
      app: data.app,
      bundleId: data.bundleId,
      url: data.url,
      window: data.window,
      favicon: data.favicon,
      title: data.title,
      selectedText: data.selectedText,
      screenshotPath: data.screenshotPath,
      activeViewContent: data.activeViewContent,
      comment: data.comment,
    };

    const filePath = FileService.getTimestampedPath(CONFIG.directories.captures, data.type, "json");
    await FileService.ensureDirectory(CONFIG.directories.captures);
    await FileService.saveJSON(filePath, cleanData);
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
          const parsedData = JSON.parse(content) as CapturedData;
          console.debug("Parsed data:", parsedData);

          if (!parsedData.id || !parsedData.timestamp || !parsedData.type) {
            console.debug("Skipping invalid capture:", parsedData);
            return null;
          }

          return {
            path: filePath,
            data: parsedData,
            timestamp: new Date(parsedData.timestamp),
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
    console.log("Getting active app info...");
    const frontMostApp = await getFrontmostApplication();
    console.log("Got frontmost app:", JSON.stringify(frontMostApp, null, 2));
    const appName = frontMostApp.name;
    const bundleId = frontMostApp.bundleId ?? null;

    let url = null;
    let favicon = null;
    let title = null;

    console.log("Checking if browser:", appName, "is in supported list:", CONFIG.supportedBrowsers);
    if (CONFIG.supportedBrowsers.includes(appName as BrowserApp)) {
      console.log("Getting tab info for browser:", appName);
      const tab = await BrowserService.getActiveTabInfo(appName);
      console.log("Got tab result:", JSON.stringify(tab, null, 2));
      if (tab) {
        console.log("Got active tab:", JSON.stringify(tab, null, 2));
        url = tab.url ?? null;
        favicon = tab.favicon ?? null;
        title = tab.title ?? null;
        console.log("Values before creating context:", { url, favicon, title });
      } else {
        console.log("No tab info returned");
      }
    } else {
      console.log("Not a supported browser");
    }

    const context: CaptureContext = {
      app: appName,
      bundleId,
      url,
      window: frontMostApp.name,
      favicon,
      title,
    };

    console.log("Generated context:", JSON.stringify(context, null, 2));
    return context;
  },
};

export const BrowserService = {
  async getActiveTabInfo(appName: string | null) {
    console.debug("BrowserService.getActiveTabInfo called with:", appName);
    if (!appName || !CONFIG.supportedBrowsers.includes(appName as BrowserApp)) {
      console.debug("Invalid browser app:", appName);
      return null;
    }

    try {
      console.debug("Getting tabs for browser:", appName);
      const tabs = await BrowserExtension.getTabs();
      console.debug("Got tabs:", JSON.stringify(tabs, null, 2));

      // Get all active tabs
      const activeTabs = tabs.filter((tab) => tab.active);
      console.debug("Active tabs:", JSON.stringify(activeTabs, null, 2));

      // If there's only one active tab, use it
      if (activeTabs.length === 1) {
        console.debug("Single active tab found:", activeTabs[0]);
        return activeTabs[0];
      }

      console.debug("Multiple active tabs found, getting content to match");
      const content = await BrowserExtension.getContent({ format: "markdown" });
      if (content) {
        console.debug("Got content length:", content.length);
        console.debug("Content preview:", content.substring(0, 200));

        // First try exact URL matches
        for (const tab of activeTabs) {
          if (tab.url && content.includes(tab.url)) {
            console.debug("Found exact URL match:", tab);
            return tab;
          }
        }

        // Then try title matches
        for (const tab of activeTabs) {
          if (tab.title && content.includes(tab.title)) {
            console.debug("Found title match:", tab);
            return tab;
          }
        }

        // Try partial URL matches as last resort
        for (const tab of activeTabs) {
          if (tab.url) {
            const urlWithoutProtocol = tab.url.replace(/^https?:\/\//, "");
            if (content.includes(urlWithoutProtocol)) {
              console.debug("Found partial URL match:", tab);
              return tab;
            }
          }
        }
      }

      console.debug("No matching tab found, using first active tab");
      return activeTabs[0] ?? null;
    } catch (error) {
      console.debug(`Failed to get tab info for ${appName}:`, error);
      return null;
    }
  },

  async getActiveTabURL(appName: string | null) {
    const tab = await this.getActiveTabInfo(appName);
    return tab?.url ?? null;
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
    await handleError(error, "Capture Failed");
  },
};

export const CaptureService = {
  async createCaptureData(
    type: string,
    selectedText: string | null,
    screenshotPath: string,
    activeViewContent: string,
  ): Promise<CaptureData> {
    const context = await WindowService.getActiveAppInfo();
    console.debug("Got content length:", activeViewContent.length);

    const captureData: CaptureData = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      selectedText,
      screenshotPath,
      activeViewContent,
      title: context.title,
      favicon: context.favicon,
      url: context.url,
    };

    console.debug("Created capture data:", captureData);
    return captureData;
  },

  async createCapture(type: CaptureType, getData: () => Promise<CaptureInput>): Promise<CapturedData> {
    const timestamp = new Date().toISOString();
    const data = await getData();
    const context = await WindowService.getActiveAppInfo();
    console.log("Got context in createCapture:", JSON.stringify(context, null, 2));
    console.log("Context fields:", {
      app: context.app,
      bundleId: context.bundleId,
      url: context.url,
      window: context.window,
      favicon: context.favicon,
      title: context.title,
    });
    const browserContent = CONFIG.supportedBrowsers.includes(context.app as BrowserApp)
      ? await BrowserService.getActiveTabHTML(context.app)
      : null;

    const captureData = {
      id: uuidv4(),
      type,
      timestamp,
      selectedText: data.selectedText ?? null,
      screenshotPath: data.screenshotPath ?? null,
      activeViewContent: data.activeViewContent ?? browserContent,
      ...context,
    } as CapturedData;

    console.log("Final capture data:", JSON.stringify(captureData, null, 2));
    return captureData;
  },
};
