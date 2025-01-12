import { Clipboard } from "@raycast/api";
import { CaptureService, FileService, CONFIG } from "./utils";

export default async function Command() {
  await CaptureService.capture({
    type: "clipboard",
    getData: async () => {
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      console.debug("Capturing with timestamp:", timestamp);

      const screenshotPath = await FileService.captureScreenshot(CONFIG.saveDir, timestamp);
      console.debug("Got screenshot path:", screenshotPath);

      const clipboardText = await Clipboard.readText();
      console.debug("Got clipboard text:", clipboardText);

      return {
        selectedText: clipboardText,
        screenshotPath: screenshotPath,
      };
    },
    validate: (data) => (data.selectedText ? true : "No text in clipboard"),
  });
}
