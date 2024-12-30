import {
  Form,
  showToast,
  Toast,
  BrowserExtension,
  Clipboard,
  ActionPanel,
  Action,
  getFrontmostApplication,
  getSelectedText,
} from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Configuration
const CONFIG = {
  saveDir: path.join(os.homedir(), "Downloads", "raycast-captures"),
  browserApps: ["Arc", "Brave", "Chrome", "Safari", "Firefox"] as const,
} as const;

type BrowserApp = (typeof CONFIG.browserApps)[number];

// Types
interface CapturedData {
  selectedText: string | null;
  activeAppBundleId: string | null;
  activeAppName: string | null;
  activeURL: string | null;
  timestamp: string;
  frontAppName: string | null;
}

// Services
const FileService = {
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
};

const WindowService = {
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

const BrowserService = {
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
};

// Main Component
export default function Command() {
  const handleCapture = async () => {
    try {
      await FileService.ensureDirectory(CONFIG.saveDir);

      // Gather all context data
      const { appName, bundleId } = await WindowService.getActiveAppInfo();
      let selectedText: string | null = null;
      let frontAppName: string | null = null;
      try {
        selectedText = await getSelectedText();
        const frontMostApp = await getFrontmostApplication();
        frontAppName = frontMostApp.name;
      } catch {
        // If no text is selected, try clipboard as fallback
        selectedText = (await Clipboard.readText()) ?? null;
      }
      const activeURL = await BrowserService.getActiveTabURL(appName);
      const timestamp = new Date().toISOString();

      const contextData: CapturedData = {
        selectedText,
        activeAppBundleId: bundleId,
        activeAppName: appName,
        activeURL,
        timestamp,
        frontAppName,
      };

      const jsonPath = FileService.getTimestampedPath(CONFIG.saveDir, "context-data", "json");
      await FileService.saveJSON(jsonPath, contextData);
      await showToast({
        style: Toast.Style.Success,
        title: "Context Captured",
        message: `Saved to ${jsonPath}`,
      });
    } catch (error) {
      console.error("Capture failed:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Capture Failed",
        message: String(error),
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Capture Context" onAction={handleCapture} />
        </ActionPanel>
      }
    >
      <Form.Description text="Press ⌘↩ to capture the context." />
    </Form>
  );
}
