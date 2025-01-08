# Raycast Context Capture

Capture and Save content with context, including a automatic screenshot, time, source, frontmost app, markdown of website (if in browser) and selected text and so on.

## Commands

I recommend using `Capture` and `Clipboard Capture` via hotkey.

All captures are saved to the capture directory and have metadata and automatic screenshot added.

1. **Capture**: Silently capture selection in any app.
2. **Clipboard Capture**: Capture clipboard text instantly.
3. **Comment Captures**: Add/edit capture comments.
4. **Comment Screenshots**: Comment on recent screenshots -- once a screenshot is commented it moves to the capture directory.
5. **Manage Directories**: Set capture directory (where to save) and your screenshot directory (where to interact with screenshots from).

## Configuration

- **Screenshots Directory**: Default `~/Desktop/`
- **Capture Directory**: Default `~/Downloads/`

## Troubleshooting

- Make sure to double check your directories are correct and rerun the manage directories command.
- For extra metadata browser captures (url, markdown) you need to have the raycast browser extension installed.
