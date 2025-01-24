import { getSelectedText, showToast, Toast } from "@raycast/api";
import { utils, createCapture, CONFIG } from "./utils";
import path from "node:path";

export default async function Command() {
  try {
    await createCapture(
      "selection",
      async () => {
        const timestamp = new Date().toISOString();
        const screenshotPath = await utils.captureScreenshot(
          CONFIG.directories.captures,
          utils.sanitizeTimestamp(timestamp),
        );
        if (!screenshotPath) {
          throw new Error("Failed to capture screenshot");
        }

        let selectedText: string | null = null;
        try {
          selectedText = await getSelectedText();
        } catch {
          console.info("No text selected");
        }

        return {
          content: selectedText,
          screenshotUrl: utils.getFileUrl(screenshotPath),
        };
      },
      (data) => (data.content ? true : "No text selected"),
    );
  } catch (error) {
    console.error("Capture failed:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Capture failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
