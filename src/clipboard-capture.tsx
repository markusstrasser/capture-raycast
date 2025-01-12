import { Clipboard } from "@raycast/api";
import { capture, screenshot, CONFIG } from "./utils";

export default async function Command() {
  await capture.save(
    "clipboard",
    async () => {
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      console.debug("Capturing with timestamp:", timestamp);

      const screenshotPath = await screenshot.capture(CONFIG.directories.captures, timestamp);
      console.debug("Got screenshot path:", screenshotPath);

      const clipboardText = await Clipboard.readText();
      console.debug("Got clipboard text:", clipboardText);

      return {
        selectedText: clipboardText,
        screenshotPath,
      };
    },
    (data) => (data.selectedText ? true : "No text in clipboard"),
  );
}
