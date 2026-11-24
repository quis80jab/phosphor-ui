# Phosphor UI handoff

Public visual-source snapshot, 24 November 2026. Start here when integrating this system into another program.

This is a buildless browser ES-module application. It runs in a web app or a desktop webview with WebGL 2. The handoff includes the actual UI source, optical shaders, glyphs, component states, pages, tests, vendored libraries and licenses. It is not a screenshot kit or a React package.

## Open the saved system

Clone the repository, enter `phosphor-ui`, and serve its `dist` directory:

```sh
python3 -m http.server 5189 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:5189/handoff.html` for backup/restore and the integration example. Existing pages remain:

| Entry | Contents |
| --- | --- |
| `dist/index.html` | Position-setting and transport screens; six tunable optical layers; named looks and PNG bake |
| `dist/workbench.html` | Twelve interactive controls with per-control edits, notes, optics and reference-screen console |
| `dist/ui-pages.html` | Component catalog and assembled welcome, cases, parts, value and logistics pages |
| `dist/viewer.html` | Cube, bundled Pumpkin splats, voxel editing, hologram map, drone cluster, Direct Operate and local compatible `.mcap` replay. Optional external scan entries are disabled until their data is installed |
| `dist/blank.html?page=home` | UI/flow designer with seven collapsible page groups, linked pages, rectangles/dividers, a floating tool palette and named-panel UI preview. The preview draws synthetic topology and sample records; add `&data=demo` for the earlier synthetic preview. Import `handoff/designer/arachnid.flow-design.json` for the full outline |
| `dist/integration-example.html` | Small independent host program using the exported UI kit |

The public repository includes all visual modules, the element catalog, the full flow layout, tests, fonts and vendored dependencies. Only the credited Pumpkin capture is bundled. See `docs/OPTIONAL-ASSETS.md` for additional data. Private settings snapshots are excluded.

## Program entry: native controls

Copy `dist` into the host's static asset directory, retaining relative module, vendor and font paths. Import the kit and mount into an ordinary DOM container:

```js
import { mountPhosphorKit } from './phosphor-kit.js';

const ui = mountPhosphorKit({
  container: document.querySelector('#controls'),
  columns: 48,
  pattern: 'dots',
  optics: { brightness: 110, glow: 40, contrast: 110, grid: 50, refraction: 0 },
  controls: [
    { id: 'enabled', type: 'toggle', label: 'OUTPUT', value: true,
      layout: { column: 0, row: 0, columns: 16, rows: 3 } },
    { id: 'gain', type: 'slider', label: 'Gain', value: 62, min: 0, max: 100, step: 1,
      layout: { column: 0, row: 4, columns: 48, rows: 3 } },
    { id: 'query', type: 'search', label: 'Search', placeholder: 'SEARCH CHANNELS',
      layout: { column: 0, row: 8, columns: 48, rows: 3 } }
  ],
  onChange({ id, type, value, values, event }) {
    // Connect the actual host program here. values contains all control values.
    console.log(id, value);
  }
});

ui.update('gain', { value: 80 }); // Program updates do not emit onChange.
const values = ui.getValues();
const definition = ui.getState(); // JSON-serializable controls + layout + optics.
ui.setPattern('hashes');
ui.setOptics({ glow: 25 });
// ui.destroy(); // Required when the host unmounts this view.
```

Supported kit controls: `button`, `toggle`, `slider`, `search`, `label`. Button values count activations; toggles use booleans; sliders use numbers; text controls use strings. IDs are stable alphanumeric names beginning with a letter. `update(id, patch)` changes properties but cannot change a mounted control's type. `getControlElement(id)` returns the native accessible input/button for host integration. `render()` refreshes layout and paint. The host owns persistence; the kit does not write local storage.

To remount a saved kit definition, validate `format === 'phosphor-kit'` and `version === 1`, then pass its `controls`, `columns`, `pattern` and `optics` to `mountPhosphorKit` with the new container and callbacks. Use one kit/compositor per page when practical. The compositor covers the browser viewport and clips to the mounted container; it preserves global pixel alignment rather than scaling a small canvas to fit.

The complete reusable inventory is in `component-manifest.json` and `COMPONENTS.md`. The kit also re-exports `paintGridControl`, `createViewerGridRenderer`, glyph helpers, grid constants, and the twelve workbench painters/catalog. A raw painter draws artwork only; the host must supply interaction and state. `paintWidget` uses its authored 320 x 200 logical surface. Do not stretch that artwork to substitute for destination-sized viewer controls.

## Assemble richer screens

Use the module contracts and required CSS listed in the component manifest:

- `mountReadinessComponent(host, id, options)` mounts the sixteen readiness component views; `mountReadiness(host, page, options)` assembles their pages.
- `mountLogistics(host, options)` mounts the interactive logistics map and alerts. Its cleanup function removes its listeners.
- `mountUIPagesSkin({getState})` rasterizes page controls using `[data-vfd]` and `canvas#ui-pages-gl`; it is document-scoped, so isolate it from a separate kit compositor.
- `mountDroneCluster`, `mountMapMarkerFlag` and `mountDirectOperate` accept host callbacks and telemetry. Their matching CSS and painters are required.
- `createCubeViewer` supplies the actual scene and camera controller. Copy the existing viewer shell when reusing the whole viewer: its DOM IDs and tool wiring are part of that application, not a generic component constructor.

For Direct Operate, `setDirectOperate(true)` enters the simulated flight mode; `setDroneInput({yaw,lift,forward,strafe})` accepts axes in [-1,1]. Left stick controls yaw/lift, right stick forward/strafe. `clearDroneInput()` neutralizes commands. `setDirectOperate(false)` leaves the drone hovering at its flown position and restores the original map view. Position, heading, attitude, GPS and the chase/map/FPV cameras share one flight model. These are simulated controls, not a real-drone connection. See the current viewer wiring for blur, visibility, context loss and teardown handling.

## Preserve the render contract

Two divisible grids are intentional:

1. Display pitch: `PIXEL_PITCH = 2 / 1.4` CSS pixels. One source texel represents one display cell.
2. UI layout: `UI_PIXELS = 8`; `UI_CELL = 8 * PIXEL_PITCH`. Use whole UI-cell spans and gaps.

Paint buttons, labels and frames at their final integer display-pixel bounds. Keep 5 x 7 glyphs and one-pixel rules fixed. Reflow narrow screens; do not scale previously painted controls. Keep one screen-aligned grid across the window, scene and overlays. The rendering order is native scene -> shared scene sampling + raster UI -> universal VFD optical shader. Avoid adding separate per-component grids or bloom layers. Preserve accessible DOM controls as hit targets and the native fallback when WebGL is unavailable.

## Saved settings and restoration

No browser snapshots are included in this public repository. Backup/restore works locally for your own settings; export only data you intend to share. Different browser origins own separate local storage.

The backup envelope uses `format: 'phosphor-project-backup'`, `version: 3`, `origin`, `createdAt`, `entries`, and `transientExclusions`. `entries` holds all eleven application storage keys (including the SaaS workspace and layout designer) and three possible recovery keys as exact serialized strings or explicit `null`. Versions 1 and 2 remain accepted with their original twelve and thirteen keys. Restoring either version cannot remove newer designer state; version 1 also leaves SaaS settings untouched, including in replace mode. Raw data is preserved even when an older entry is malformed. The app's existing normalizers determine how its saved state loads. `project-backup.schema.json` describes the envelope; `parseProjectBackup` is the runtime validator, including the 16 MiB limit.

```js
import {
  createProjectBackup, parseProjectBackup, restoreProjectBackup,
  defaultProjectSettings, STORAGE_KEYS
} from './project-backup.js';

const snapshot = createProjectBackup(localStorage, {
  origin: location.origin, createdAt: new Date().toISOString()
});
const parsed = parseProjectBackup(uploadedJsonText);
restoreProjectBackup(parsed, localStorage, { mode: 'merge' });
// Close other lab tabs before restoring; reopen them afterward.
```

Close other lab tabs before restoring, because their active autosaves can overwrite imported settings. Reopen them afterward. Merge mode restores only non-null entries. Replace mode also removes allowlisted keys explicitly absent in the snapshot. Neither touches unrelated storage. Restore validates before writes, snapshots destination values and attempts rollback if storage fails; a restore error reports whether rollback completed. Keep a destination backup before replacing settings.

`default-settings.json` is the versioned factory baseline, not a claim that all browser origins use those values. It includes optical settings, workbench widgets, viewer, page, readiness, logistics, SaaS and designer defaults. The designer starts with seven main pages plus three blank linked pages: Sign in, Sign up and Reset password. Its layout document is version 2; the storage key remains `phosphor-flow-designer-v1` and the full project backup envelope remains version 3. Missing snapshot entries stay absent and follow the app's normal initialization path.

In the designer, all pages appear in the left rail under Home, Site, Cases, Assets, System, Calendar and Analyze. Use the separate disclosure buttons to expand each group or **Expand All** to review the full flow. **Manage pages** below the rail separator opens the page dialog and creates named pages. Pages can also be targeted by a rectangle or divider's page link and opened with **Follow link**. Grouping is navigation metadata and does not alter saved page IDs or layouts. Sign-in, sign-up and password-reset pages are blank design surfaces; no authentication service or account handling is implemented. See [the designer contract](COMPONENTS.md#ui-and-flow-designer) for layout fields, limits and version 1 migration.

**UI preview** renders recognized named rectangles using the pure canvas painters adapted from `sandbox-ui/elements.html`. These painters draw at the saved bounds inside the same VFD framebuffer and shader. Their sample data and interactions are demonstrations; preview does not rewrite the layout geometry, labels or links. Use **Edit layout** to return to authoring.

System preview also provides a selectable device topology with sensor, processor, Admin and Viewer node types, labeled connection styles, and details that follow the selection. The Admin/Viewer switch demonstrates editable versus read-only UI behavior. It is not an authentication system, and its control buttons change local demo state only. The graph uses available space beside the saved panels, or a rectangle explicitly labeled `Topology`; it keeps the saved layout intact.

Not captured: active flight pose/joystick input, free-orbit camera pose, current lasso/selection and undo history, open transient panels, playback running state, drone-feed choice/zoom, uncommitted form drafts, generated PNG blobs, loaded OSM tiles or GPU caches. Source code and all saved configurations are preserved; these transient states must be recreated by the host if needed. Active flight inputs should always start neutral.

## Validation and ownership

Run the source checks with Node:

```sh
node --test tests/*.test.mjs
```

The handoff adds round-trip, malformed-file, storage-failure/rollback and programmatic control tests. Browser verification covers the backup page and live integration controls. A passing code test is not a certification for real drone operation or calibrated sensing.

Three.js r187 and Spark 2.4.0 are vendored with MIT notices. Original UI code is licensed under MIT; see the root LICENSE. Third-party data retains its own license. Keep OSM attribution and asset notices. The croissant capture is CC BY-NC 4.0; Pumpkin and Shopping Center are CC BY 4.0. The UI can be reused without bundling these demonstration datasets. OSM heights/colors and sensor feeds include labeled estimates or simulated data.

To make a fresh package after changes, run `node tools/prepare-handoff.mjs`, run the tests, save the exact source commit, then run `python3 tools/package-handoff.py --output /absolute/output/folder`. Do not place private snapshots in `dist`.

## SaaS workspace and chart library

Open `saas.html` for six connected prototype screens: overview, fleet, inspections, analytics, instruments, and workspace settings. These use deterministic demo data and browser-local preferences/reviews, not a backend or real aircraft connection. See [the product plan](SAAS-PLAN.md) for the pilot and production roadmap, and [the chart API](SAAS-COMPONENTS.md) to reuse the seven raster chart types in another program.
