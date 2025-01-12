import { Form, ActionPanel, Action, showHUD, popToRoot, Toast } from "@raycast/api";
import { useState } from "react";
import { utils, CONFIG } from "../utils";
import type { CapturedData } from "../utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";

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
  const imagePath = path.join(CONFIG.directories.captures, `screenshot-${utils.sanitizeTimestamp(timestamp)}.png`);
  const jsonPath = path.join(CONFIG.directories.captures, `screenshot-${utils.sanitizeTimestamp(timestamp)}.json`);

  await utils.ensureDirectory(CONFIG.directories.captures);
  await fs.copyFile(sourcePath, imagePath);

  const captureData: CapturedData = {
    ...data,
    id: path.basename(jsonPath, ".json"),
    timestamp,
    screenshotPath: utils.getFileUrl(imagePath),
    comment,
  };

  await utils.saveJSON(jsonPath, captureData);
  return jsonPath;
};

export function CommentForm({ data, filePath, onCommentSaved }: CommentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    if (!values.comment?.trim()) return;

    setIsSubmitting(true);
    try {
      if (data.type === "screenshot" && filePath.startsWith(CONFIG.directories.screenshots)) {
        const screenshotPath = data.screenshotPath;
        if (!screenshotPath) {
          throw new Error("Screenshot path is missing");
        }
        await handleScreenshotComment(data, utils.stripFileProtocol(screenshotPath), values.comment);
      } else {
        const updatedData = { ...data, comment: values.comment };
        await utils.saveJSON(filePath, updatedData);
      }

      await showHUD("Comment saved");
      await popToRoot();
      onCommentSaved?.();
    } catch (error) {
      console.error("Failed to save comment:", error);
      await utils.showToast({
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
        placeholder="Add your comment here..."
        defaultValue={data.comment}
        enableMarkdown
      />
    </Form>
  );
}
