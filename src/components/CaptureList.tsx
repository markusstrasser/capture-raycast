import { List, ActionPanel, Action } from "@raycast/api";
import type { CapturedData } from "../utils";
import * as path from "node:path";
import { PreferenceActions } from "./PreferenceActions";
import { CommentForm } from "./CommentForm";

export interface CaptureFile {
  path: string;
  metadataPath?: string;
  data: CapturedData;
  timestamp: Date;
}

interface CaptureListProps {
  captures: CaptureFile[];
  isLoading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRefresh?: () => void;
  onCommentSaved?: () => void;
}

export function CaptureList({
  captures,
  isLoading,
  emptyTitle = "No captures found",
  emptyDescription = "Capture something first using the Quick Capture command",
  onRefresh,
  onCommentSaved,
}: CaptureListProps) {
  if (captures.length === 0 && !isLoading) {
    return (
      <List>
        <List.EmptyView
          title={emptyTitle}
          description={emptyDescription}
          actions={
            onRefresh && (
              <ActionPanel>
                <PreferenceActions onRefresh={onRefresh} />
              </ActionPanel>
            )
          }
        />
      </List>
    );
  }

  const renderItem = (capture: CaptureFile) => {
    const date = new Date(capture.data.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateString = date.toLocaleDateString([], { month: "short", day: "numeric" });
    const icon = capture.data.favicon || (capture.data.activeViewContent ? "🌐" : "🗒️");
    const title =
      capture.data.title || path.basename(capture.path).startsWith("screenshot-")
        ? path.basename(capture.path)
        : `${timeString} - ${capture.data.app || "Unknown"}`;

    const metadata = [
      { label: "Type", value: capture.data.type },
      { label: "Timestamp", value: date.toLocaleString() },
      { label: "App", value: capture.data.app },
      { label: "Bundle ID", value: capture.data.bundleId },
      { label: "Window", value: capture.data.window },
    ].filter((item): item is { label: string; value: string } => Boolean(item.value));

    if (capture.data.selectedText?.trim()) {
      metadata.push({ label: "Selected Text", value: capture.data.selectedText.trim() });
    }

    if (capture.data.comment) {
      metadata.push({ label: "Comment", value: capture.data.comment });
    }

    const markdown = capture.data.screenshotPath
      ? `![Screenshot](${capture.data.screenshotPath.replace(/^file:\/\//, "")})`
      : undefined;

    return (
      <List.Item
        icon={icon}
        title={title}
        subtitle={capture.data.url || undefined}
        accessories={[{ text: dateString }, ...(capture.data.comment ? [{ icon: "💭" }] : [])]}
        detail={
          <List.Item.Detail
            markdown={markdown}
            metadata={
              <List.Item.Detail.Metadata>
                {metadata.map((item) => (
                  <List.Item.Detail.Metadata.Label key={item.label} title={item.label} text={item.value} />
                ))}
              </List.Item.Detail.Metadata>
            }
          />
        }
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
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search captures..." isShowingDetail>
      {captures.map((capture) => renderItem(capture))}
    </List>
  );
}
