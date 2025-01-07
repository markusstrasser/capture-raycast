import {
  BrowserExtension,
  Clipboard,
  getFrontmostApplication,
  showToast as raycastShowToast,
  Toast,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Configuration
export const CONFIG = {
  saveDir: path.join(os.homedir(), "Documents/MIND/", "CaptureInbox"),
  browserApps: ["Arc", "Brave", "Chrome", "Safari", "Firefox"] as const,
} as const;

export type BrowserApp = (typeof CONFIG.browserApps)[number];

// Types
export interface CapturedData {
  // Content
  content: {
    text: string | null; // Previously clipboardText
    html: string | null; // Previously browserTabHTML
    screenshot: string | null; // Previously screenshotPath
  };

  // Source info
  source: {
    app: string | null; // Previously activeAppName
    bundleId: string | null; // Previously activeAppBundleId
    url: string | null; // Previously activeURL
    window: string | null; // Previously frontAppName
  };

  // Metadata
  metadata: {
    timestamp: string;
    comment?: string;
  };
}

// Services
export const FileService = {
  async ensureDirectory(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  },

  async saveJSON(filePath: string, data: unknown) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  },

  getTimestampedPath(base: string, name: string, ext: string) {
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    return path.join(base, `${name}-${timestamp}.${ext}`);
  },

  async captureScreenshot(saveDir: string, timestamp: string): Promise<string | null> {
    try {
      const outputPath = path.join(saveDir, `screenshot-${timestamp}.png`);
      const script = `do shell script "screencapture -x '${outputPath}'"`;
      await runAppleScript(script);

      try {
        await fs.access(outputPath);
        return outputPath;
      } catch {
        return null;
      }
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      return null;
    }
  },

  async captureAreaScreenshot(saveDir: string, timestamp: string): Promise<string | null> {
    try {
      const outputPath = path.join(saveDir, `screenshot-${timestamp}.png`);
      // -i for interactive (area selection), -s for silent mode
      const script = `do shell script "screencapture -i -s '${outputPath}'"`;
      await runAppleScript(script);

      try {
        await fs.access(outputPath);
        return outputPath;
      } catch {
        return null;
      }
    } catch (error) {
      console.error("Area screenshot capture failed:", error);
      return null;
    }
  },
};

export const WindowService = {
  async getActiveAppInfo() {
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
    return { appName, bundleId };
  },
};

export const BrowserService = {
  async getActiveTabURL(appName: string | null) {
    if (!appName || !CONFIG.browserApps.includes(appName as BrowserApp)) return null;
    try {
      const tabs = await BrowserExtension.getTabs();
      const activeTab = tabs.find((tab) => tab.active);
      return activeTab?.url ?? null;
    } catch {
      return null;
    }
  },

  async getActiveTabHTML(appName: string | null): Promise<string | null> {
    if (!appName || !CONFIG.browserApps.includes(appName as BrowserApp)) return null;
    try {
      return await BrowserExtension.getContent({ format: "html" });
    } catch (error) {
      console.error("Failed to capture HTML:", error);
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

export async function captureContext(): Promise<CapturedData> {
  // Capture timestamp early for consistent naming
  const timestamp = new Date().toISOString();
  const formattedTimestamp = timestamp.replace(/:/g, "-");

  // Start screenshot capture
  await FileService.ensureDirectory(CONFIG.saveDir);
  const screenshotPath = await FileService.captureScreenshot(CONFIG.saveDir, formattedTimestamp);

  // Gather all other context
  const { appName, bundleId } = await WindowService.getActiveAppInfo();
  const clipboardText = (await Clipboard.readText()) ?? null;
  const frontMostApp = await getFrontmostApplication();
  const frontAppName = frontMostApp.name;
  const activeURL = await BrowserService.getActiveTabURL(appName);

  // Capture HTML if in browser
  const browserTabHTML = await BrowserService.getActiveTabHTML(appName);

  return {
    content: {
      text: clipboardText,
      html: browserTabHTML,
      screenshot: screenshotPath,
    },
    source: {
      app: appName,
      bundleId,
      url: activeURL,
      window: frontAppName,
    },
    metadata: {
      timestamp,
    },
  };
}
