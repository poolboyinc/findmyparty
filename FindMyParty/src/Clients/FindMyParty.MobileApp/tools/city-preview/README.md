# City preview

Looks at the City tab's map without a phone. It draws the very layer list the app uses
(`components/city/layers.ts`, fed by `geojson.ts` and the live demo venues) with Mapbox GL JS in
headless Chrome and saves pictures.

```sh
# from the app folder
node --no-warnings --import ./tools/city-preview/hooks.mjs tools/city-preview/preview.mjs            # every shot
node --no-warnings --import ./tools/city-preview/hooks.mjs tools/city-preview/preview.mjs default selected
node --no-warnings --import ./tools/city-preview/hooks.mjs tools/city-preview/preview.mjs z15.4 Monkey@17.5
```

Pictures land in `/tmp/city-preview` (or `$OUT`). Shots: `default`, `selected`, `near`, `close`,
`far`, `mine`, `flat`, `backdrop`; `z<zoom>` is the default view at another zoom; `<Venue>@<zoom>`
looks at one venue (`SELECT=1` selects it).

- `PLACE='{"Monkey":[19.2635,42.4405]}'` tries venues somewhere else without touching the server.
- `PULSE=0|1|2` shows the roof pulse caught at that ripple.
- `MAPBOX_TOKEN`, `API_URL` override what `eas.json` holds. `CHROME` names the browser binary.

Needs Node 24 (it loads the app's TypeScript as it is) and Google Chrome.

Mapbox GL JS and the iOS SDK share one style language but not one renderer. The pictures are a
close guide to shapes, sizes, order and colour; they are not proof of how a phone draws it.

`make-sprites.mjs` (same `--import`) redraws the light pictures in `assets/images/city` from the
mock's own drawing code. After adding or renaming one, list it in `components/city/city-images.ts`.
