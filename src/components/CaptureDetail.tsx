import { List } from "@raycast/api";
import type { CapturedData } from "../utils";

interface CaptureDetailProps {
  data: CapturedData;
}

export function CaptureDetail({ data }: CaptureDetailProps) {
  const metadata = [
    { label: "App", value: data.app },
    { label: "Bundle ID", value: data.bundleId },
    { label: "Window", value: data.window },
    { label: "Title", value: data.title },
    { label: "URL", value: data.url },
    { label: "Timestamp", value: new Date(data.timestamp).toLocaleString() },
    { label: "Comment", value: data.comment },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  const markdown = [
    data.favicon && `![Favicon](${data.favicon})`,
    data.selectedText && `**Selected Text**\n${data.selectedText}`,
    data.screenshotPath && `![Screenshot](${data.screenshotPath.replace(/^file:\/\//, "")})`,
    data.activeViewContent && `**Page Content**\n${data.activeViewContent}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          {metadata.map((item) => (
            <List.Item.Detail.Metadata.Label key={item.label} title={item.label} text={item.value} />
          ))}
        </List.Item.Detail.Metadata>
      }
      markdown={markdown || undefined}
    />
  );
}
