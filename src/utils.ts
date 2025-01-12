import winston from "winston";
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

// Logger setup
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Types
interface Preferences {
  screenshotsDirectory: string;
  captureDirectory: string;
}

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

// Configuration
export const CONFIG = {
  directories: {
    captures: getPreferenceValues<Preferences>().captureDirectory.replace("~", os.homedir()),
    screenshots: getPreferenceValues<Preferences>().screenshotsDirectory.replace("~", os.homedir()),
  },
  supportedBrowsers: ["Arc", "Brave", "Chrome", "Safari", "Firefox", "Orion"] as const,
} as const;

// File operations
const ensureDirectory = async (dir: string): Promise<void> => {
  logger.debug("Ensuring directory exists:", { dir });
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    logger.error("Failed to create directory:", { dir, error });
    throw error;
  }
};

const getTimestampedPath = (base: string, name: string, ext: string): string => {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  return path.join(base, `${name}-${timestamp}.${ext}`);
};

const saveJSON = async (filePath: string, data: unknown): Promise<void> => {
  logger.debug("Saving JSON", { filePath });
  const dir = path.dirname(filePath);
  await ensureDirectory(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

const captureScreenshot = async (saveDir: string, timestamp: string): Promise<string | null> => {
  try {
    await ensureDirectory(saveDir);
    const outputPath = path.join(saveDir, `screenshot-${timestamp}.png`);
    await runAppleScript(`do shell script "screencapture -x '${outputPath}'"`);

    try {
      await fs.access(outputPath);
      return outputPath;
    } catch {
      return null;
    }
  } catch (error) {
    logger.error("Screenshot capture failed:", { error });
    return null;
  }
};

// Browser operations
const isSupportedBrowser = (appName: string | null): appName is BrowserApp =>
  Boolean(appName && CONFIG.supportedBrowsers.includes(appName as BrowserApp));

const getActiveTabInfo = async (appName: string | null) => {
  if (!isSupportedBrowser(appName)) {
    return { url: null, title: null, favicon: null };
  }

  try {
    const tabs = await BrowserExtension.getTabs();
    const activeTabs = tabs.filter((tab) => tab.active);

    if (activeTabs.length > 1) {
      const script = `
        tell application "${appName}"
          return title of active tab of front window
        end tell
      `;
      try {
        const currentTitle = await runAppleScript(script);
        const matchingTab = activeTabs.find((tab) => tab.title === currentTitle);
        if (matchingTab) {
          return {
            url: matchingTab.url ?? null,
            title: matchingTab.title ?? null,
            favicon: matchingTab.favicon ?? null,
          };
        }
      } catch (error) {
        logger.debug("Failed to get current window title:", { error });
      }
    }

    const activeTab = activeTabs[0];
    return {
      url: activeTab?.url ?? null,
      title: activeTab?.title ?? null,
      favicon: activeTab?.favicon ?? null,
    };
  } catch (error) {
    logger.debug("Failed to get tab info:", { browser: appName, error });
    return { url: null, title: null, favicon: null };
  }
};

const getActiveTabHTML = async (appName: string | null): Promise<string | null> => {
  if (!isSupportedBrowser(appName)) return null;

  try {
    return await BrowserExtension.getContent({ format: "markdown" });
  } catch {
    return null;
  }
};

// Window operations
const getActiveAppInfo = async (): Promise<CaptureContext> => {
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
  const tabInfo = await getActiveTabInfo(appName);

  return {
    app: appName,
    bundleId,
    url: tabInfo.url,
    window: frontMostApp.name,
    title: tabInfo.title,
    favicon: tabInfo.favicon,
  };
};

// Toast operations
const showToast = {
  capturing: () =>
    raycastShowToast({
      style: Toast.Style.Animated,
      title: "Capturing context...",
    }),

  success: (message?: string) =>
    raycastShowToast({
      style: Toast.Style.Success,
      title: "Context Captured",
      message: message ?? "⌘K to add a comment",
    }),

  error: (error: unknown) => {
    logger.error("Capture failed:", { error });
    return raycastShowToast({
      style: Toast.Style.Failure,
      title: "Capture Failed",
      message: String(error),
    });
  },
};

// Capture operations
const loadCaptures = async (directory: string) => {
  await ensureDirectory(directory);
  const files = await fs.readdir(directory);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const captures = await Promise.all(
    jsonFiles.map(async (f) => {
      const filePath = path.join(directory, f);
      try {
        const data = JSON.parse(await fs.readFile(filePath, "utf-8")) as CapturedData;
        if (!data.id || !data.timestamp || !data.type) return null;

        return {
          path: filePath,
          data,
          timestamp: new Date(data.timestamp),
        };
      } catch (error) {
        logger.error("Failed to load capture:", { filePath, error });
        return null;
      }
    }),
  );

  return captures
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const createCapture = async (type: CaptureType, getData: () => Promise<CaptureInput>) => {
  const timestamp = new Date().toISOString();
  const data = await getData();
  const context = await getActiveAppInfo();
  const browserContent = isSupportedBrowser(context.app) ? await getActiveTabHTML(context.app) : null;

  return {
    id: uuidv4(),
    type,
    timestamp,
    selectedText: data.selectedText ?? null,
    screenshotPath: data.screenshotPath ?? null,
    activeViewContent: data.activeViewContent ?? browserContent,
    ...context,
    favicon: context.favicon ?? null,
    title: context.title ?? null,
  };
};

const capture = async (
  type: CaptureType,
  getData: () => Promise<CaptureInput>,
  validate?: (data: CaptureInput) => boolean | string,
) => {
  try {
    await showToast.capturing();

    const data = await getData();
    logger.debug("Raw capture data:", { data });

    if (validate) {
      const validationResult = validate(data);
      if (validationResult !== true) {
        throw new Error(typeof validationResult === "string" ? validationResult : "Validation failed");
      }
    }

    const captureData = await createCapture(type, async () => data);
    const filePath = getTimestampedPath(CONFIG.directories.captures, type, "json");
    await saveJSON(filePath, captureData);

    await showToast.success();
    await closeMainWindow();
    await popToRoot();
  } catch (error) {
    await showToast.error(error);
  }
};

// Exports
export const FileService = { ensureDirectory, saveJSON, getTimestampedPath, captureScreenshot };
export const CaptureManager = { save: saveJSON, load: loadCaptures };
export const WindowService = { getActiveAppInfo };
export const BrowserService = { getActiveTabInfo, getActiveTabHTML };
export const ToastService = showToast;
export const CaptureService = { createCapture, capture };
