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
