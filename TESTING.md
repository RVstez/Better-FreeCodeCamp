# Setup and testing

This guide covers running Better-FreeCodeCamp from a GitHub ZIP download and checking its main features. Node.js and a modern browser are required. The editor, lesson data, and runtime dependencies are bundled in the repository.

## Download the project

On the repository's GitHub page, choose **Code -> Download ZIP**. These instructions assume the main-branch download is named `better-freecodecamp-main.zip` and contains a folder named `better-freecodecamp-main`.

Extract the ZIP into the parent directory where the project should live. The archive creates the project folder itself. When extraction is complete, `better-freecodecamp-main/tools/serve.mjs` should exist. If the branch or repository name differs, use the actual archive and folder names in the commands below.

## Android (Termux)

Save the ZIP in your phone's Downloads folder. In Termux, install Node.js and the ZIP extractor, then enable shared-storage access:

```sh
pkg install nodejs unzip
termux-setup-storage
```

Grant the Android storage permission when prompted. Then extract the project into Termux's home directory and start the server:

```sh
unzip ~/storage/downloads/better-freecodecamp-main.zip -d ~
cd ~/better-freecodecamp-main
node tools/serve.mjs
```

Open [http://localhost:8080](http://localhost:8080) in your browser. To reduce interruptions while the initial files are being cached, use **Acquire wakelock** in the Termux notification. Android may otherwise pause Termux when it is in the background.

## Windows

Install Node.js and save the ZIP in your Downloads folder. Open PowerShell and run:

```powershell
cd "$env:USERPROFILE\Downloads"
Expand-Archive -LiteralPath .\better-freecodecamp-main.zip -DestinationPath .
cd .\better-freecodecamp-main
node tools/serve.mjs
```

You can also extract the ZIP with File Explorer. Open a terminal in the extracted folder that contains `package.json`, `public`, and `tools`, then run `node tools/serve.mjs`. Some extraction tools create an extra outer folder; check that `tools/serve.mjs` is directly inside your current project directory.

## macOS and Linux

Install Node.js and save the ZIP in your Downloads folder. With `unzip` available, run:

```sh
unzip ~/Downloads/better-freecodecamp-main.zip -d ~
cd ~/better-freecodecamp-main
node tools/serve.mjs
```

Alternatively, extract the ZIP with your file manager and run the server from the resulting `better-freecodecamp-main` project directory.

## Starting and stopping the app

The server prints `Better-FreeCodeCamp running at http://localhost:8080`. Open that address in your browser. Keep the server running during the initial load while the app caches its files; cached lessons and the editor can then work offline.

To stop the server, press `Ctrl+C` in its terminal. To start it again:

```sh
cd ~/better-freecodecamp-main
node tools/serve.mjs
```

The command above assumes the home-directory extraction used in the Termux and macOS/Linux examples. On Windows, return to the project folder in Downloads.

If port 8080 is busy, run `node tools/serve.mjs 8081` and open `http://localhost:8081`. Progress and code are saved per browser and address, including the port number.

## Updating an existing installation

Stop the server, replace the updated files at their matching paths in the existing project, then restart it and refresh the browser. Server startup regenerates the offline-cache version.

If using a fresh ZIP download, extract it into a new directory and start the server from the folder containing `tools/serve.mjs`. Keep using the same browser and localhost port to access existing progress. The progress menu provides export and import for moving saved work.

## Manual checks

### Navigation and layout

- Open the overview, a chapter, a module, and each practice category. Check that the content fits the screen and the controls remain readable.
- Toggle the sidebar on a wide screen, then reopen it. The main content should use the available width in both states.
- On a phone, open and close the navigation drawer using its toggle, close button, and backdrop.
- Search for a lesson using the header search or `Ctrl+K`. Check filtering, arrow-key selection, and opening a result with Enter.
- Check that navigation buttons display their arrows correctly.

### Editor and lesson checks

- Open a workshop step and edit the code. Confirm that the preview updates and a page reload restores the saved code.
- Run **Check your code** and confirm that the results appear. A passing step should be marked complete.
- Try the font-size controls, reset, full screen, and preview-width presets.
- On a phone, switch between Code and Preview.

### Copying lesson links and examples

1. Open Cat Photo App, step 8. Tap the icon beside the `relaxing-cat.jpg` URL and paste it into the editor's `src` value. Only the URL should be pasted.
2. With the editor focused, press `Ctrl+Shift+Y` or `Cmd+Shift+Y`. It should copy the requested URL while preserving the code, cursor, and focus.
3. Focus the copy icon under the logo example and press the shortcut. It should copy the logo URL. The top-right icon should copy the entire code example with its original whitespace.
4. Try an `href` URL, a relative file path, and a CSS `url(...)` value. Each control should copy its exact value.
5. Check that touch copy controls remain visible, can be tapped, and do not cause horizontal page overflow. Successful copying should show a check mark and a confirmation message.
6. Confirm that the normal `Ctrl+C` shortcut still copies a selection.

### Quizzes and progress

- Answer a lecture question and complete a quiz. Feedback should remain visible until advancing to the next question.
- Check that answer buttons work normally and contain no copy buttons.
- Reload the page and confirm that completed lessons, saved code, and quiz results are retained.
- Export progress, then import it and confirm that the saved work is restored.

### Offline use

Let the initial caching finish, then stop the local server and reload the app. Open a previously cached lesson and check the editor, lesson tests, search, and copy controls.

External lesson images may still require an internet connection. Their descriptions are shown when the images cannot load.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` / `Cmd+K` | Find a lesson |
| `?` | Open the shortcut reference outside the editor |
| `Escape` | Close a dialog, mobile drawer, or full-screen editing |
| `Ctrl+B` | Toggle the sidebar |
| `Ctrl+P` / `Ctrl+N` | Previous / next step |
| `Ctrl+Shift+G` | Run lesson checks and show the results |
| `Ctrl+M` | Focus the editor, enter full screen, then leave it |
| `Ctrl+Shift+Y` / `Cmd+Shift+Y` | Copy a lesson reference; focus a copy icon or select a reference to choose another item |
| `Ctrl+Q` | Cycle through questions |
| `Alt+up arrow‘` / `Alt+down arrow“` | Move between answers |
| `Ctrl+Alt` | Choose the focused answer |

Some desktop browsers reserve `Ctrl+N` and `Ctrl+P`; on-screen navigation is also available. In workshop instructions, the copy shortcut defaults to the last inline link. In lectures, it uses the nearest visible item.

For keyboard troubleshooting, open `http://localhost:8080/?keys`. The on-screen display shows whether Ctrl, Shift, and Alt are reported as pressed. This can help identify a stuck modifier on an external keyboard.

## Automated tests

From the project root, run:

```sh
npm test
```

Additional browser scripts are in `tools/test/`. They require Playwright and Chromium, and their runtime paths may need adjusting for the local environment.

Previous Chromium checks covered desktop and mobile layouts, sidebar toggling, editor behavior, lesson checks, quizzes, copying, clipboard fallback, and offline reloads. Mobile layouts were checked using resized browser viewports; these checks do not substitute for testing on a physical Android device.

## Known limitations

- Lesson images hosted on freeCodeCamp's CDN require a connection.
- The certification exam entry is a reference only; the source data does not include exam questions.
