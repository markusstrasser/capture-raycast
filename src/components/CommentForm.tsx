import { Form, ActionPanel, Action, showHUD, popToRoot, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { files, CONFIG } from "../utils";
import type { CapturedData } from "../utils";
import * as path from "node:path";
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

export function CommentForm({ data, filePath, onCommentSaved }: CommentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsSubmitting(true);

      // If this is a screenshot from the screenshots directory, copy it to captures
      if (data.type === "screenshot" && data.screenshotPath?.startsWith("file://")) {
        const sourcePath = data.screenshotPath.replace(/^file:\/\//, "");
        console.debug("Source screenshot path:", sourcePath);

        if (sourcePath.startsWith(CONFIG.directories.screenshots)) {
          console.debug("Copying screenshot to captures directory");

          // Generate new paths
          const timestamp = new Date().toISOString().replace(/:/g, "-");
          const newImagePath = path.join(CONFIG.directories.captures, `screenshot-${timestamp}.png`);
          const newJsonPath = path.join(CONFIG.directories.captures, `screenshot-${timestamp}.json`);

          // Ensure captures directory exists
          await files.ensureDirectory(CONFIG.directories.captures);

          // Copy the image
          console.debug("Copying from:", sourcePath);
          console.debug("Copying to:", newImagePath);
          await fs.copyFile(sourcePath, newImagePath);
          console.debug("Copied screenshot to:", newImagePath);

          // Create new capture data
          const captureData: CapturedData = {
            id: uuidv4(),
            type: "screenshot",
            timestamp: new Date().toISOString(),
            screenshotPath: `file://${newImagePath}`,
            comment: values.comment,
            selectedText: null,
            activeViewContent: null,
            app: data.app,
            bundleId: data.bundleId,
            url: data.url,
            window: data.window,
            favicon: data.favicon,
            title: data.title,
          };

          // Save the JSON
          await files.saveJSON(newJsonPath, captureData);
          console.debug("Saved capture data to:", newJsonPath);
        } else {
          // For existing captures in the captures directory, just update the comment
          const updatedData = {
            ...data,
            comment: values.comment,
          };
          await files.saveJSON(filePath, updatedData);
        }
      } else {
        // For non-screenshot captures or those without a path, just update the comment
        const updatedData = {
          ...data,
          comment: values.comment,
        };
        await files.saveJSON(filePath, updatedData);
      }

      await showHUD("✓ Added comment");
      onCommentSaved?.();
      await popToRoot();
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
