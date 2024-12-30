import { Form, ActionPanel, Action, showHUD, popToRoot, showToast, Toast, List } from "@raycast/api";
import { FileService, CONFIG } from "./utils";
import type { CapturedData } from "./utils";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { useState, useEffect, useCallback } from "react";

interface FormValues {
  comment: string;
  tags: string;
}

interface CaptureFile {
  path: string;
  data: CapturedData;
  timestamp: Date;
}

function CaptureDetail({ data }: { data: CapturedData }) {
  const markdown = `
${data.clipboardText ? `${data.clipboardText}\n\n` : "No content captured\n\n"}
${data.screenshotPath ? `![Screenshot](${data.screenshotPath})\n` : ""}
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

          {data.browserTabHTML && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="HTML Preview" text={`${data.browserTabHTML.slice(0, 200)}...`} />
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
      const updatedData = {
        ...capture.data,
        comment: values.comment,
        tags: values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await FileService.saveJSON(capture.path, updatedData);
      await showHUD("✓ Added comment and tags");
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
        placeholder="Add any notes about this capture..."
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
        title="Capture Info"
        text={`${capture.data.activeAppName} - ${new Date(capture.data.timestamp).toLocaleString()}`}
      />
    </Form>
  );
}

export default function Command() {
  const [captures, setCaptures] = useState<CaptureFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCaptures = useCallback(async () => {
    try {
      await FileService.ensureDirectory(CONFIG.saveDir);
      const files = await fs.readdir(CONFIG.saveDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const captureFiles: CaptureFile[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(CONFIG.saveDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content) as CapturedData;
        captureFiles.push({
          path: filePath,
          data,
          timestamp: new Date(data.timestamp),
        });
      }

      // Sort by timestamp, newest first
      captureFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setCaptures(captureFiles);
    } catch (error) {
      console.error("Failed to load captures:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Load Captures",
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
        <List.EmptyView
          title="No captures found"
          description="Capture something first using the Quick Capture command"
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search captures..." isShowingDetail>
      {captures.map((capture) => {
        const date = new Date(capture.data.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateString = date.toLocaleDateString([], { month: "short", day: "numeric" });

        const icon = capture.data.browserTabHTML ? "🌐" : "🗒️";

        return (
          <List.Item
            key={capture.path}
            icon={icon}
            title={`${timeString} - ${capture.data.activeAppName || "Unknown"}`}
            subtitle={capture.data.clipboardText?.slice(0, 50)}
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
                {capture.data.activeURL && (
                  <Action.OpenInBrowser
                    title="Open URL"
                    url={capture.data.activeURL}
                    shortcut={{ modifiers: ["cmd"], key: "o" }}
                  />
                )}
                {capture.data.screenshotPath && (
                  <Action.Open
                    title="Open Screenshot"
                    target={capture.data.screenshotPath}
                    shortcut={{ modifiers: ["cmd"], key: "s" }}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
