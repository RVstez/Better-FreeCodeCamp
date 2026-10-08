// Loads Monaco Editor (the same engine freeCodeCamp itself uses — confirmed via their client/package.json,
// bundled here from the real monaco-editor@0.55.1 package) entirely from local files. No network access;
// its own worker wiring (self.MonacoEnvironment) is already set up inside editor.main.js, nothing to configure.
let ready;
export function loadMonaco() {
  return (ready ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/monaco/min/vs/loader.js';
    // Disposing an editor while one of its language-service requests is in flight rejects that request with "Canceled".
    // That is Monaco's normal way of abandoning work; without this it shows up as an uncaught error on every fast navigation.
    window.addEventListener('unhandledrejection', (e) => { if (e.reason?.name === 'Canceled' || e.reason?.message === 'Canceled') e.preventDefault(); });
    s.onload = () => {
      window.require.config({ paths: { vs: 'vendor/monaco/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        const monaco = window.monaco;
        monaco.editor.defineTheme('rvstez-dark', {
          base: 'vs-dark', inherit: true, rules: [{ token: '', background: '171a18' }],
          colors: { 'editor.background': '#171a18', 'editor.foreground': '#f2f3f3', 'editor.lineHighlightBackground': '#252a26',
            'editorLineNumber.foreground': '#666c70', 'editorLineNumber.activeForeground': '#92979b', 'editor.selectionBackground': '#303630',
            'editorCursor.foreground': '#bed5b0', 'editorIndentGuide.background1': '#252a26', 'editorWidget.background': '#151719',
            'editorWidget.border': '#303630', 'editorSuggestWidget.background': '#151719', 'editorSuggestWidget.border': '#303630' } });
        resolve(monaco);
      }, reject);
    };
    s.onerror = () => reject(new Error('Monaco failed to load'));
    document.head.append(s);
  }));
}
const LANG = { html: 'html', css: 'css', js: 'javascript', javascript: 'javascript' };

const active = new Set();
// Called by the router before rendering a new page — Monaco editors aren't torn down just because their
// container leaves the DOM (unlike a plain textarea), so without this every navigation would leak an editor.
export function disposeEditors() { for (const ed of active) ed.dispose(); active.clear(); }

// Creates one editor bound to a container. The app's own shortcuts (Ctrl+M, Ctrl+Shift+G, …) are handled at the
// document level in capture phase (app.js), so they win over Monaco's own bindings for the same keys — Monaco binds
// Ctrl+M to "toggle Tab focus mode" and Ctrl+G to "Go to line".
export async function createEditor(container, { lang, value, fontSize = 13 }) {
  const monaco = await loadMonaco();
  const editor = monaco.editor.create(container, {
    value, language: LANG[lang] ?? 'plaintext', theme: 'rvstez-dark', automaticLayout: true,
    minimap: { enabled: false }, fontFamily: 'OsakaMono, ui-monospace, monospace', fontSize, fontLigatures: false,
    scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2, renderLineHighlight: 'none', overviewRulerLanes: 0,
    padding: { top: 10, bottom: 10 }, ariaLabel: `${lang} code editor`,
  });
  active.add(editor); editor.onDidDispose(() => active.delete(editor));
  return editor;
}
