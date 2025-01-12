import { Form, ActionPanel, Action, showHUD, popToRoot, showToast, Toast, List } from "@raycast/api";
import { FileService, CONFIG } from "./utils";
import type { CapturedData } from "./utils";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { useState, useEffect, useCallback } from "react";
import { CaptureDetail } from "./components/CaptureDetail";

interface FormValues {
  comment: string;
}

interface CaptureFile {
  path: string;
  data: CapturedData;
  timestamp: Date;
}

function CommentForm({ capture, onCommentSaved }: { capture: CaptureFile; onCommentSaved?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsSubmitting(true);
      const updatedData = {
        ...capture.data,
        comment: values.comment,
      };
      await FileService.saveJSON(capture.path, updatedData);
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
        defaultValue={capture.data.comment}
        enableMarkdown
      />
      <Form.Description
        title="Capture Info"
        text={`${capture.data.app || "Unknown"} - ${new Date(capture.data.timestamp).toLocaleString()}`}
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
      console.debug("Found JSON files:", jsonFiles);

      const captureFiles: CaptureFile[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(CONFIG.saveDir, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          console.debug("Raw file content:", content);

          const data = JSON.parse(content) as CapturedData;
          console.debug("Parsed capture data:", data);

          if (!data.id || !data.timestamp) {
            console.debug("Skipping invalid capture data:", data);
            continue;
          }

          captureFiles.push({
            path: filePath,
            data,
            timestamp: new Date(data.timestamp),
          });
        } catch (error) {
          console.error("Failed to load capture:", error);
        }
      }

      // Sort by timestamp, newest first
      captureFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      console.debug("Sorted captures:", captureFiles);
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

        const icon = capture.data.activeViewContent ? "🌐" : "🗒️";

        return (
          <List.Item
            key={capture.path}
            icon={icon}
            title={`${timeString} - ${capture.data.app || "Unknown"}`}
            subtitle={capture.data.selectedText?.slice(0, 50)}
            accessories={[{ text: dateString }, ...(capture.data.comment ? [{ icon: "💭" }] : [])]}
            detail={<CaptureDetail data={capture.data} />}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Add or Edit Comment"
                  target={<CommentForm capture={capture} onCommentSaved={loadCaptures} />}
                  shortcut={{ modifiers: ["cmd"], key: "e" }}
                />
                {capture.data.url && (
                  <Action.OpenInBrowser
                    title="Open URL"
                    url={capture.data.url}
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
