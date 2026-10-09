# Better-FreeCodeCamp

Better-FreeCodeCamp is an offline-first learning app for the real freeCodeCamp Responsive Web Design v9
curriculum. It runs from a tiny local server. Nothing is installed system-wide, and after the first load it
keeps working even if the server stops.

**Requirements:** [Node.js](https://nodejs.org) (any recent version) and a modern browser.

## Android (Termux)

You'll the android app 'Termux'.

```shell
pkg install nodejs
mkdir -p ~/bfv0.7
tar -xf ~/storage/downloads/bfv0.7-fixed.tar -C ~/bfv0.7 --strip-components=1
cd ~/bfv0.7
node tools/serve.mjs
```

Tip: pull down the Termux notification and tap **Acquire wakelock**, and exempt Termux from battery optimisation.
Android can pause Termux in the background; the app now copes with that after its first load, but the first load needs the server.

## Windows

1. Install Node.js from [nodejs.org](https://nodejs.org).
2. In Command Prompt, in the folder holding the download:
   ```cmd
   mkdir better-freecodecamp
   tar -xf bfv0.7-fixed.tar -C better-freecodecamp --strip-components=1
   cd better-freecodecamp
   node tools\serve.mjs
   ```
   (If `tar` isn't recognised, extract with 7-Zip instead; the files are inside a `better-freecodecamp` folder.)

## macOS

```shell
mkdir -p ~/better-freecodecamp
tar -xf ~/Downloads/bfv0.7-fixed.tar -C ~/better-freecodecamp --strip-components=1
cd ~/better-freecodecamp
node tools/serve.mjs
```

## Opening it

The terminal prints `Better-FreeCodeCamp running at http://localhost:8080`. Open that in your browser and leave the
terminal running. To start it again later: `cd` into the folder and run `node tools/serve.mjs`.
If port 8080 is busy, run `node tools/serve.mjs 8081` and open `http://localhost:8081`.
After replacing the files with a newer build, stop the old server first (Ctrl+C, or `pkill -f serve.mjs` in Termux), then start it again.

## Features

- **The real curriculum**, in its real order: chapters, modules, workshops, labs, lectures, reviews, quizzes.
- **Real checking.** freeCodeCamp's own test engine runs each lesson's original tests in a sandbox.
- **A real editor.** Monaco (the engine behind VS Code, and freeCodeCamp's own), with a live preview, width presets
  (Fit / 768 / 375), font size, reset, copy, full screen and autosave.
- **Lectures** with "Check your understanding" cards; **quizzes** one question at a time with the real pass mark and a best-attempt record;
  **reviews** you mark as reviewed.
- **Practice pages** for workshops, labs and reviews, and certification projects, plus the exam reference.
- **Progress saved on your device**, with export, import and reset in the ⋯ menu.
- **Works offline after the first load**, even if the local server stops or is paused.

## Keyboard shortcuts

| Keys | Does |
|---|---|
| `Ctrl+K` or `Cmd+K` | Find a lesson; arrow keys select a result and Enter opens it |
| `?` | Open the keyboard reference when outside a text field or editor |
| `Escape` | Close search, the keyboard reference, the mobile drawer, or full-screen editing |
| `Ctrl+B` | Show or hide the sidebar |
| `Ctrl+P` / `Ctrl+N` | Previous / next step (also while typing in the editor) |
| `Ctrl+Shift+G` | Check your code: leaves the editor and scrolls to the results |
| `Ctrl+M` | Editor: first press focuses it and scrolls to it; second opens full screen; third leaves full screen and the editor and shows the checks |
| `Ctrl+Q` | Cycle through questions |
| `Alt+↑` / `Alt+↓` | Move between answers |
| `Ctrl+Alt` | Pick the focused answer |

## If keys seem stuck

Open `http://localhost:8080/?keys`. A small box at the bottom-left shows, for every key you press, whether Ctrl, Shift and Alt are down (1) or up (0).
If Shift shows `1` while you are not holding it, that is your keyboard or Android, not the app.

## Known gaps

- Lesson images come from freeCodeCamp's servers: they need a connection and show their description when offline.
- The exam is a pointer only in the source data; there are no exam questions.
