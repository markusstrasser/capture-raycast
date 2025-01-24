import { getSelectedText, showToast, Toast, getFrontmostApplication } from "@raycast/api";
import { utils } from "./utils";
import { CLIConfig } from "./config";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execAsync = promisify(exec);

export default async function Command() {
  try {
    const timestamp = new Date().toISOString();
    const screenshotPath = await utils.captureScreenshot(CLIConfig.mediaFolder, utils.sanitizeTimestamp(timestamp));
    if (!screenshotPath) {
      throw new Error("Failed to capture screenshot");
    }

    let selectedText: string | null = null;
    try {
      selectedText = await getSelectedText();
    } catch {
      console.info("No text selected");
    }

    // Get app context with error handling
    let context = null;
    let browserContent = null;
    try {
      const frontMostApp = await getFrontmostApplication();
      context = await utils.getActiveWindowInfo();
      browserContent = utils.isSupportedBrowser(context.app) ? await utils.getActiveTabContent(context.app) : null;
    } catch (error) {
      console.error("Failed to get window/tab info:", error);
    }

    // Build event data
    const eventData = {
      type: "imageAnnotate",
      source: "raycast",
      image: path.basename(screenshotPath),
      comment: selectedText || null,
      timestamp: timestamp,
      ...(context && {
        app: context.app,
        url: context.url || null,
        title: context.pageTitle || context.windowTitle || null,
      }),
    };

    // Execute CLI command
    const cmd = `${CLIConfig.bunExecutable} ${CLIConfig.cli.path} store '${JSON.stringify(eventData)}'`;
    console.log("Executing command:", cmd);

    const { stdout, stderr } = await execAsync(cmd);
    console.log("Command output:", stdout);

    if (stderr) {
      console.error("Command stderr:", stderr);
    }

    await showToast({
      style: Toast.Style.Success,
      title: "Capture saved",
    });
  } catch (error) {
    console.error("Capture failed:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Capture failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
