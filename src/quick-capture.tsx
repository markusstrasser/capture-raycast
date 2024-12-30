import { showToast, Toast } from "@raycast/api";
import { FileService, captureContext, CONFIG } from "./utils";
import * as path from "node:path";

export default async function Command() {
  try {
    await showToast({ style: Toast.Style.Animated, title: "Capturing context..." });

    const capturedData = await captureContext();

    // Save the data
    const jsonPath = FileService.getTimestampedPath(CONFIG.saveDir, "context-data", "json");
    await FileService.saveJSON(jsonPath, capturedData);

    await showToast({
      style: Toast.Style.Success,
      title: "Context Captured",
      message: `Saved to ${path.basename(jsonPath)}`,
    });
  } catch (error) {
    console.error("Quick capture failed:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Capture Failed",
      message: String(error),
    });
  }
}
