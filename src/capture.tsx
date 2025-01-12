import { getSelectedText } from "@raycast/api";
import { capture, screenshot, CONFIG, paths } from "./utils";

export default async function Command() {
  await capture.save("selection", async () => {
    const timestamp = new Date().toISOString();
    const screenshotPath = await screenshot.capture(CONFIG.directories.captures, paths.sanitizeTimestamp(timestamp));

    let selectedText: string | null = null;
    try {
      selectedText = await getSelectedText();
    } catch {
      console.info("No text selected");
    }

    return {
      selectedText,
      screenshotPath: screenshotPath ? paths.getFileUrl(screenshotPath) : null,
    };
  });
}
