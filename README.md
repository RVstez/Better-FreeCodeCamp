# Better-FreeCodeCamp

Better-FreeCodeCamp is a local learning app for freeCodeCamp's Responsive Web Design v9 curriculum. It brings lessons, a code editor, live previews, and progress tracking into a dark interface that works on desktop and mobile.

The app uses vanilla JavaScript and a small Node.js server. There is no framework or build step, and the editor and lesson data are included in the repository. After the first load, the app can run from the browser's offline cache.

## Features

- **Lessons and practice:** follow the curriculum in order, or browse lectures, workshops, labs, reviews, and certification projects.
- **Code editor:** write HTML and CSS in Monaco with a live preview, autosave, font-size controls, and full-screen editing.
- **Lesson checks:** run the original freeCodeCamp tests against your code. Quizzes show answer feedback and save your results.
- **Search:** find lessons by topic, project name, or lesson type. Practice pages also have filters.
- **Copy controls:** copy URLs, file paths, and code examples with a button or keyboard shortcut.
- **Mobile layout:** switch between Code and Preview on smaller screens, with a navigation drawer for moving between lessons.
- **Local progress:** save completed lessons and code in your browser, with export and import available in the progress menu.

## Getting started

You will need Node.js and a modern browser. On GitHub, choose **Code -> Download ZIP**. The download is named `Better-FreeCodeCamp-main.zip` and contains the project folder `Better-FreeCodeCamp-main`.

Extract the ZIP, then open a terminal in the directory containing the extracted folder and run:

```sh
cd Better-FreeCodeCamp-main
node tools/serve.mjs
```

Open [http://localhost:8080](http://localhost:8080). Runtime dependencies are bundled, so an `npm install` is not required to start the app.

If you cloned the repository instead, run the server from your checkout's root directory. To use another port:

```sh
node tools/serve.mjs 8081
```

### Android (Termux)

Save `Better-FreeCodeCamp-main.zip` in your phone's Downloads folder. Install Node.js and the ZIP extractor, then enable access to shared storage:

```sh
pkg install nodejs unzip
termux-setup-storage
```

Grant the Android storage permission when prompted, then run:

```sh
unzip ~/storage/downloads/Better-FreeCodeCamp-main.zip -d ~
cd ~/Better-FreeCodeCamp-main
node tools/serve.mjs
```

The ZIP already contains the `Better-FreeCodeCamp-main` folder, so extract it into your home directory. See [TESTING.md](TESTING.md) for Windows and macOS/Linux commands and manual checks.

Keep the server running during the initial load while the app caches its files. After updating the project, restart the server and refresh the browser to update the offline cache. Progress is stored per browser and address, including the port number.

## Copying links and examples

Copy icons appear beside lesson URLs and file paths. Code examples have a top-right button for copying the whole block, plus separate controls for link values such as `src`, `href`, and CSS `url(...)`.

Press **Ctrl+Shift+Y** or **Cmd+Shift+Y** to copy a reference. In workshop steps, the shortcut uses the last inline link in the instructions. Focus a copy button or select a reference to choose a different item. In lectures, it uses the nearest visible item. Copying with the shortcut preserves the editor's cursor and focus.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` / `Cmd+K` | Search lessons |
| `?` | Open the shortcut reference outside the editor |
| `Ctrl+B` | Toggle the sidebar |
| `Ctrl+P` / `Ctrl+N` | Previous / next step |
| `Ctrl+Shift+G` | Run checks and show the results |
| `Ctrl+M` | Focus the editor, enter full screen, then leave it |
| `Ctrl+Shift+Y` / `Cmd+Shift+Y` | Copy a lesson link or code block |
| `Ctrl+Q` | Cycle through questions |
| `Alt+ArrowUp` / `Alt+ArrowDown` | Move between answers |
| `Ctrl+Alt` | Choose the focused answer |
| `Escape` | Close a dialog, mobile navigation, or full-screen editing |

Some desktop browsers reserve shortcuts such as `Ctrl+N` and `Ctrl+P`. The same actions are available through on-screen controls.

## Development

| Directory | Contents |
| --- | --- |
| `public/js/` | Rendering, navigation, editor, progress, and lesson checks |
| `public/css/` | Styles and fonts |
| `public/data/` | Curriculum manifest and lesson data |
| `public/vendor/` | Bundled Monaco editor and curriculum test helpers |
| `tools/` | Local server, data generation, offline-cache generation, and tests |

Run the unit tests with:

```sh
npm test
```

The scripts in `tools/test/` also include browser checks. They require Playwright and a Chromium installation; the runtime paths in those scripts may need adjusting for your machine. See [TESTING.md](TESTING.md) for setup instructions and manual checks.

`tools/serve.mjs` regenerates `public/sw.js` at startup. Curriculum generation and verification use `tools/build-curriculum.mjs` and `tools/verify-normalization.mjs`; verification requires the original `source/rwd-v9-full-export.json`, which is not included.

## Limitations

- Lesson images hosted on freeCodeCamp's CDN require an internet connection. Their descriptions are shown when they cannot load.
- The certification exam entry is a reference only; the source data does not include exam questions.

## Credits

The curriculum, lesson tests, and curriculum helpers come from freeCodeCamp. The editor uses Monaco. Third-party license files are included with the bundled packages in `public/vendor/`.
