import { Form, ActionPanel, Action, showHUD, popToRoot, showToast, Toast, List, Detail } from "@raycast/api";
import { FileService, CONFIG, WindowService } from "./utils";
import type { CapturedData } from "./utils";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { useState, useEffect, useCallback } from "react";

const SCREENSHOTS_DIR = path.join(os.homedir(), "Desktop", "Screenshots");

interface FormValues {
  comment: string;
  tags: string;
}

interface CaptureFile {
  path: string;
  metadataPath: string;
  data: CapturedData;
  timestamp: Date;
}

function CaptureDetail({ data }: { data: CapturedData }) {
  const markdown = `
${data.screenshotPath ? `![Screenshot](${data.screenshotPath})` : ""}
`;

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Timestamp" text={new Date(data.timestamp).toLocaleString()} />
          <List.Item.Detail.Metadata.Separator />

          <List.Item.Detail.Metadata.Label title="Source" text={data.activeAppName || "Unknown"} />
          <List.Item.Detail.Metadata.Label title="Bundle ID" text={data.activeAppBundleId || "None"} />

          {data.activeURL && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Link title="URL" target={data.activeURL} text={data.activeURL} />
            </>
          )}

          {data.comment && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Comment" text={data.comment} />
            </>
          )}

          {data.tags && data.tags.length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.TagList title="Tags">
                {data.tags.map((tag) => (
                  <List.Item.Detail.Metadata.TagList.Item text={tag} key={tag} />
                ))}
              </List.Item.Detail.Metadata.TagList>
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function CommentForm({ capture, onCommentSaved }: { capture: CaptureFile; onCommentSaved?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsSubmitting(true);

      // Create timestamp for consistent naming
      const timestamp = new Date().toISOString();
      const formattedTimestamp = timestamp.replace(/:/g, "-");

      // Copy screenshot to captures folder
      await FileService.ensureDirectory(CONFIG.saveDir);
      const extension = path.extname(capture.path);
      const newScreenshotPath = path.join(CONFIG.saveDir, `screenshot-${formattedTimestamp}${extension}`);
      await fs.copyFile(capture.path, newScreenshotPath);

      // Save metadata with same convention as other captures
      const updatedData = {
        ...capture.data,
        timestamp,
        screenshotPath: newScreenshotPath,
        comment: values.comment,
        tags: values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const jsonPath = FileService.getTimestampedPath(CONFIG.saveDir, "context-data", "json");
      await FileService.saveJSON(jsonPath, updatedData);

      await showHUD("✓ Added comment and copied to captures");
      onCommentSaved?.();
      await popToRoot();
    } catch (error) {
      console.error("Failed to save comment:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Save Comment",
        message: String(error),
      });
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
        placeholder="Add any notes about this screenshot..."
        defaultValue={capture.data.comment}
        enableMarkdown
      />
      <Form.TextField
        id="tags"
        title="Tags"
        placeholder="tag1, tag2, tag3"
        defaultValue={capture.data.tags?.join(", ")}
      />
      <Form.Description
        title="Screenshot Info"
        text={`${path.basename(capture.path)} - ${new Date(capture.data.timestamp).toLocaleString()}`}
      />
    </Form>
  );
}

export default function Command() {
  const [captures, setCaptures] = useState<CaptureFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCaptures = useCallback(async () => {
    try {
      // Ensure metadata directory exists
      const metadataDir = path.join(SCREENSHOTS_DIR, ".metadata");
      await FileService.ensureDirectory(metadataDir);

      // Get all image files
      const files = await fs.readdir(SCREENSHOTS_DIR);
      const imageFiles = files.filter((f) => /\.(png|gif|mp4|jpg|jpeg)$/i.test(f));

      const captureFiles: CaptureFile[] = [];
      for (const file of imageFiles) {
        const filePath = path.join(SCREENSHOTS_DIR, file);
        const metadataPath = path.join(metadataDir, `${file}.json`);
        const stats = await fs.stat(filePath);

        let data: CapturedData;
        try {
          const content = await fs.readFile(metadataPath, "utf-8");
          data = JSON.parse(content);
        } catch {
          // If no metadata exists, create new metadata
          const { appName, bundleId } = await WindowService.getActiveAppInfo();
          data = {
            timestamp: stats.birthtime.toISOString(),
            screenshotPath: `file://${filePath}`,
            activeAppName: appName,
            activeAppBundleId: bundleId,
            activeURL: null,
            clipboardText: null,
            frontAppName: appName,
            browserTabHTML: null,
          };
          await FileService.saveJSON(metadataPath, data);
        }

        captureFiles.push({
          path: filePath,
          metadataPath,
          data,
          timestamp: new Date(data.timestamp),
        });
      }

      // Sort by timestamp, newest first
      captureFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setCaptures(captureFiles);
    } catch (error) {
      console.error("Failed to load screenshots:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Load Screenshots",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  if (captures.length === 0 && !isLoading) {
    return (
      <List>
        <List.EmptyView title="No screenshots found" description="Take a screenshot with CleanShot first" />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search screenshots..." isShowingDetail>
      {captures.map((capture) => {
        const date = new Date(capture.data.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateString = date.toLocaleDateString([], { month: "short", day: "numeric" });

        return (
          <List.Item
            key={capture.path}
            icon="🖼️"
            title={path.basename(capture.path)}
            subtitle={capture.data.comment?.slice(0, 50)}
            accessories={[
              { text: dateString },
              ...(capture.data.tags?.length
                ? [{ text: `#${capture.data.tags[0]}`, tooltip: `Tags: ${capture.data.tags.join(", ")}` }]
                : []),
              ...(capture.data.comment ? [{ icon: "💭" }] : []),
            ]}
            detail={<CaptureDetail data={capture.data} />}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Add/Edit Comment"
                  target={<CommentForm capture={capture} onCommentSaved={loadCaptures} />}
                  shortcut={{ modifiers: ["cmd"], key: "e" }}
                />
                <Action.Open
                  title="Open Screenshot"
                  target={capture.path}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
