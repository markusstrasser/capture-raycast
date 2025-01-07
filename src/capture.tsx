import { closeMainWindow, popToRoot } from "@raycast/api";
import { FileService, captureContext, CONFIG, ToastService } from "./utils";

export default async function Command() {
  try {
    await ToastService.showCapturing();

    const capturedData = await captureContext();
    const jsonPath = FileService.getTimestampedPath(CONFIG.saveDir, "context-data", "json");
    await FileService.saveJSON(jsonPath, capturedData);

    await ToastService.showSuccess();
    await closeMainWindow();
    await popToRoot();
  } catch (error) {
    await ToastService.showError(error);
  }
}
