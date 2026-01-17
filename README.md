# Themed Wordsearch Generator

Simple Node.js CLI to create themed wordsearch puzzles.

Usage examples:

Generate a wordsearch from the `animals` theme and print to console:

```
node index.js --theme=animals --size=12
```

Generate from a custom list and save an HTML file:

```
node index.js --words="cat,dog,fox" --size=10 --html=out.html
```

Generate a printer-friendly HTML (larger grid, hides word list when printing):

```
node index.js --theme=animals --size=12 --html=out_print.html --print
```

Teacher mode (no backwards words):

```
node index.js --theme=animals --size=12 --html=out_teacher.html --teacher
```

Age presets (CLI):

```
node index.js --theme=animals --age="8-10" --html=out_age.html
```

Web UI: use the `Age` dropdown to pick an age group — it will set a suitable grid size and difficulty.

Available sample themes are in `themes.json` (animals, fruits, planets). To add themes, edit `themes.json` with an array of words keyed by theme name.

You can also install the CLI locally and run `npx` or use the `wordsearch` bin if you link the package.
  
Packaging as a desktop app (installer)
------------------------------------
If you want to distribute the app to family members as a desktop app, you can package it with Electron.

1) Install dev dependencies locally:

```bash
npm install --save-dev electron electron-packager
```

2) Run the app in development (requires `electron`):

```bash
npm run electron
```

3) Create a Windows executable (on Windows):

```bash
npm run package-win
```

This produces a `dist/ThemedWordsearch-win32-x64` folder containing the executable which you can distribute or wrap in an installer.

Notes:
- The packaging commands require Node and npm on your machine.
- You can use `electron-builder` for creating an installer (MSI/NSIS) if you need an installer file; `electron-packager` only bundles the app.
