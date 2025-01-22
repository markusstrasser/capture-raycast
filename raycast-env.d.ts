/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Screenshots Directory - Directory where screenshots are stored */
  "screenshotsDirectory": string,
  /** Capture Directory - Directory where captures are stored */
  "captureDirectory": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `capture` command */
  export type Capture = ExtensionPreferences & {}
  /** Preferences accessible in the `clipboard-capture` command */
  export type ClipboardCapture = ExtensionPreferences & {}
  /** Preferences accessible in the `clipboard-capture-with-comment` command */
  export type ClipboardCaptureWithComment = ExtensionPreferences & {}
  /** Preferences accessible in the `comment-capture` command */
  export type CommentCapture = ExtensionPreferences & {}
  /** Preferences accessible in the `comment-screenshot` command */
  export type CommentScreenshot = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-directories` command */
  export type ManageDirectories = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `capture` command */
  export type Capture = {}
  /** Arguments passed to the `clipboard-capture` command */
  export type ClipboardCapture = {}
  /** Arguments passed to the `clipboard-capture-with-comment` command */
  export type ClipboardCaptureWithComment = {}
  /** Arguments passed to the `comment-capture` command */
  export type CommentCapture = {}
  /** Arguments passed to the `comment-screenshot` command */
  export type CommentScreenshot = {}
  /** Arguments passed to the `manage-directories` command */
  export type ManageDirectories = {}
}

