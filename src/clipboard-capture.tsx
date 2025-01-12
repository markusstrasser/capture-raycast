import { Clipboard } from "@raycast/api";
import { capture, screenshot, CONFIG, paths } from "./utils";

export default async function Command() {
  await capture.save(
    "clipboard",
    async () => {
      const timestamp = new Date().toISOString();
      console.debug("Capturing with timestamp:", timestamp);

      const screenshotPath = await screenshot.capture(CONFIG.directories.captures, paths.sanitizeTimestamp(timestamp));
      console.debug("Got screenshot path:", screenshotPath);

      const clipboardText = await Clipboard.readText();
      console.debug("Got clipboard text:", clipboardText);

      return {
        selectedText: clipboardText,
        screenshotPath: screenshotPath ? paths.getFileUrl(screenshotPath) : null,
      };
    },
    (data) => (data.selectedText ? true : "No text in clipboard"),
  );
}
