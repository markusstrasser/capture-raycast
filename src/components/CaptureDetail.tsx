import { List } from "@raycast/api";
import type { CapturedData } from "../utils";

export function CaptureDetail({ data }: { data: CapturedData }) {
  const markdown = `
${data.selectedText ? `${data.selectedText}\n\n` : ""}
${data.screenshotPath ? `![Screenshot](${data.screenshotPath})\n` : ""}
`;

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Timestamp" text={new Date(data.timestamp).toLocaleString()} />
          <List.Item.Detail.Metadata.Separator />

          <List.Item.Detail.Metadata.Label title="Source" text={data.app || "Unknown"} />
          <List.Item.Detail.Metadata.Label title="Bundle ID" text={data.bundleId || "None"} />

          {data.url && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Link title="URL" target={data.url} text={data.url} />
            </>
          )}

          {data.comment && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Comment" text={data.comment} />
            </>
          )}

          {data.activeViewContent && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="HTML Preview"
                text={`${data.activeViewContent.slice(0, 200)}...`}
              />
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
