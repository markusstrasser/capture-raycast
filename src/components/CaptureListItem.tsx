import { List, ActionPanel, Action } from "@raycast/api";
import * as path from "node:path";
import { CaptureDetail } from "./CaptureDetail";
import { CommentForm } from "./CommentForm";
import { PreferenceActions } from "./PreferenceActions";
import type { CaptureFile } from "./CaptureList";

interface CaptureListItemProps {
  capture: CaptureFile;
  onCommentSaved?: () => void;
  onRefresh?: () => void;
}

export function CaptureListItem({ capture, onCommentSaved, onRefresh }: CaptureListItemProps) {
  const date = new Date(capture.data.timestamp);
  const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateString = date.toLocaleDateString([], { month: "short", day: "numeric" });

  const icon = capture.data.favicon || (capture.data.activeViewContent ? "🌐" : "🗒️");
  const title =
    capture.data.title || path.basename(capture.path).startsWith("screenshot-")
      ? path.basename(capture.path)
      : `${timeString} - ${capture.data.app || "Unknown"}`;

  return (
    <List.Item
      icon={icon}
      title={title}
      subtitle={capture.data.url || undefined}
      accessories={[{ text: dateString }, ...(capture.data.comment ? [{ icon: "💭" }] : [])]}
      detail={<CaptureDetail data={capture.data} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Add or Edit Comment"
              target={
                <CommentForm
                  data={capture.data}
                  filePath={capture.metadataPath || capture.path}
                  onCommentSaved={onCommentSaved}
                />
              }
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
          </ActionPanel.Section>
          {onRefresh && (
            <ActionPanel.Section>
              <PreferenceActions onRefresh={onRefresh} />
            </ActionPanel.Section>
          )}
        </ActionPanel>
      }
    />
  );
}
