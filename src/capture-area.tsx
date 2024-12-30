import { Form, ActionPanel, Action, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { FileService, CONFIG } from "./utils";
import * as path from "node:path";

interface FormValues {
  comment: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      await FileService.ensureDirectory(CONFIG.saveDir);

      // Capture area screenshot
      const screenshotPath = await FileService.captureAreaScreenshot(CONFIG.saveDir, timestamp);

      if (!screenshotPath) {
        throw new Error("Screenshot capture was cancelled or failed");
      }

      // Save metadata with comment
      const metadata = {
        timestamp,
        screenshotPath,
        comment: values.comment,
        type: "area-capture",
      };

      const jsonPath = FileService.getTimestampedPath(CONFIG.saveDir, "area-capture", "json");
      await FileService.saveJSON(jsonPath, metadata);

      await showToast({
        style: Toast.Style.Success,
        title: "Area Captured",
        message: `Saved to ${path.basename(screenshotPath)}`,
      });
    } catch (error) {
      console.error("Area capture failed:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Capture Failed",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Capture Area" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="comment" title="Comment" placeholder="Add a comment about this capture..." enableMarkdown />
    </Form>
  );
}
