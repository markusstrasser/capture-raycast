import { getPreferenceValues } from "@raycast/api";
import * as os from "node:os";

interface Preferences {
  screenshotsDirectory: string;
  captureDirectory: string;
}

export const CONFIG = {
  directories: {
    captures: getPreferenceValues<Preferences>().captureDirectory.replace("~", os.homedir()),
    screenshots: getPreferenceValues<Preferences>().screenshotsDirectory.replace("~", os.homedir()),
  },
  supportedBrowsers: ["Arc", "Brave", "Chrome", "Safari", "Firefox", "Orion"] as const,
} as const;
