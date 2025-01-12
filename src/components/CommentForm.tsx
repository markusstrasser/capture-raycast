import { Form, ActionPanel, Action, showHUD, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { files, CONFIG, data as dataUtils, paths } from "../utils";
import type { CapturedData } from "../utils";
import * as fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";

interface FormValues {
  comment: string;
}

interface CommentFormProps {
  data: CapturedData;
  filePath: string;
  onCommentSaved?: () => void;
}

const handleScreenshotComment = async (data: CapturedData, sourcePath: string, comment: string) => {
  const timestamp = new Date().toISOString();
  const capturePaths = paths.createCapturePaths("screenshot", timestamp);

  await files.ensureDirectory(CONFIG.directories.captures);
  await fs.copyFile(sourcePath, capturePaths.image);

  const captureData = dataUtils.createCaptureData(data.type, data, {
    timestamp,
    screenshotPath: capturePaths.getUrl(capturePaths.image),
    comment,
  });

  await files.saveJSON(capturePaths.json, captureData);
  return capturePaths.json;
};

export function CommentForm({ data, filePath, onCommentSaved }: CommentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsSubmitting(true);

      if (data.screenshotPath) {
        const sourcePath = paths.stripFileProtocol(data.screenshotPath);

        if (dataUtils.shouldCopyScreenshot(data, sourcePath)) {
          console.debug("Copying screenshot to captures directory");
          await handleScreenshotComment(data, sourcePath, values.comment);
        } else {
          const updatedData = dataUtils.createCaptureData(data.type, data, { comment: values.comment });
          await files.saveJSON(filePath, updatedData);
        }
      } else {
        const updatedData = dataUtils.createCaptureData(data.type, data, { comment: values.comment });
        await files.saveJSON(filePath, updatedData);
      }

      await showHUD("✓ Added comment");
      onCommentSaved?.();
    } catch (error) {
      console.error("Failed to save comment:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Save Comment",
        message: String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Comment" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="comment"
        title="Comment"
        placeholder="Add any notes about this capture..."
        defaultValue={data.comment}
        enableMarkdown
      />
      <Form.Description
        title="Capture Info"
        text={`${data.app || "Unknown"} - ${new Date(data.timestamp).toLocaleString()}`}
      />
    </Form>
  );
}
