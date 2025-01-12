import { List, ActionPanel } from "@raycast/api";
import type { CapturedData } from "../utils";
import { CaptureDetail } from "./CaptureDetail";
import { PreferenceActions } from "./PreferenceActions";
import { CaptureListItem } from "./CaptureListItem";

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

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search captures..." isShowingDetail>
      {captures.map((capture) => (
        <CaptureListItem key={capture.path} capture={capture} onCommentSaved={onCommentSaved} onRefresh={onRefresh} />
      ))}
    </List>
  );
}
