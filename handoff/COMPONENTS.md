# Phosphor component handoff

The companion `component-manifest.json` is the machine-readable index. Paths in that file are relative to the project root. Its namespaced `id` values distinguish catalog identifiers from native DOM IDs and painter types; use `nativeId` when calling the original API. The manifest describes the existing code, not an npm package or a new framework abstraction.

The inventory contains **97 entries**: 12 workbench widgets, 23 assembled page components, 27 raster types, 21 position-setting buttons, 4 transport buttons, 3 mounted drone panels and 7 SaaS charts/meters. It also identifies 34 reusable modules, their native exports and entry contracts.

## Reuse levels

| Level | Start here | Contract |
| --- | --- | --- |
| Pure state and canvas art | `dist/vfd-glyphs.js`, `dist/reference-screen.js`, `dist/transport-screen.js`, `dist/bench-widgets.js` | Call with a Canvas 2D context and data. Event wiring and persistence belong to the host program. |
| Final-size raster controls | `dist/viewer-grid-paint.js` | Supply an element-like input, a type and integer display-pixel bounds. Each frame is rebuilt at its destination size. |
| DOM to VFD adaptation | `dist/ui-pages-skin.js` | Retain semantic DOM controls with `data-vfd`; mount one `canvas#ui-pages-gl` and the adapter. The adapter discovers the whole document. |
| Interactive page pieces | `dist/ui-readiness.js`, `dist/ui-logistics.js` | Mount into a host element, pass refresh/navigation callbacks, and call the returned cleanup function. |
| Drone panels | `dist/drone-cluster.js`, `dist/direct-operate.js` | Mount over a viewer, feed real state through `receive`, route callbacks into the controller and refresh the shared skin. |
| Interactive charts and meters | `dist/saas-viz.js` | Paint integer pixels directly or bind a native canvas for point selection; the page skin supplies shared optical effects. |
| Full application | `dist/index.html`, `dist/workbench.html`, `dist/ui-pages.html`, `dist/viewer.html`, `dist/saas.html` | Serve the preserved shell and assets over HTTP. Each entry owns its layout, controller, storage and lifecycle. |

`mountViewerSkin` is specific to the viewer shell. It expects `#viewer-ui-gl`, `#cube-canvas`, `.workspace`, `.left-rail` and `#viewer-error`; it is not a general root-scoped component adapter. Use the page skin or the underlying compositor for a new host program. Mounted interfaces also use native IDs: avoid multiple copies with conflicting IDs in one document unless the host scopes/adapts those IDs.

## Keep the rendering contract

The static display pitch is `2 / 1.4` CSS pixels. One layout cell contains **8 x 8 display pixels**, so its CSS pitch is `16 / 1.4`. Seam width is `0.16 / 1.4` CSS pixels. `dist/viewer-grid.js` is authoritative; import its constants instead of duplicating rounded values.

Paint UI geometry on integer display-pixel coordinates. Size and position the DOM using complete layout cells, convert its bounds with `pixelBounds`, and redraw controls at those bounds. Reflow changes the number of cells; it must not stretch a prepainted button or its 5 x 7 glyphs. The workbench's `paintWidget` is a separate 320 x 200 authored study with an internal `size` control. It is not a substitute for destination-size viewer painting.

The viewer pipeline is native-resolution 3D scene + integer UI bitmap -> one universal VFD compositor. `createViewerGridRenderer` supplies the common aperture, brightness, glow, contrast and refraction. Keep the lattice continuous across the window and scene. Avoid separate per-control grids or multiple optical passes over the same content. Scene sampling can be smooth or cell-quantized without changing the UI lattice.

The DOM remains the interaction and accessibility layer. Preserve focus, labels, pressed/disabled state, keyboard input and fallback styling. Hide its visual paint only when the compositor reports success. Programmatic dataset changes must call the relevant `refresh`/`relayout`; moving viewer overlays should call `refreshOverlay(root)`.

A custom chart uses `<canvas data-vfd="canvas">` and assigns `canvas.vfdDraw = (ctx,width,height) => { ... }` before refreshing the page skin. The skin invokes it at final display-pixel dimensions and copies it without resampling.

## Minimal painter integration

This example executes in a browser module served from the project root. It paints one button directly at its final logical resolution; it does not mount a second optical effect.

```js
import { paintGridControl } from './dist/viewer-grid-paint.js';
import { UI_PIXELS } from './dist/viewer-grid.js';

const button = document.createElement('button');
button.textContent = 'INSPECT';
button.setAttribute('aria-pressed', 'false');
const source = document.createElement('canvas');
source.width = 12 * UI_PIXELS;
source.height = 3 * UI_PIXELS;
const ctx = source.getContext('2d');
ctx.imageSmoothingEnabled = false;

function draw() {
  ctx.clearRect(0, 0, source.width, source.height);
  paintGridControl(ctx, {
    element: button, type: 'button',
    x: 0, y: 0, width: source.width, height: source.height
  });
}
button.addEventListener('click', () => {
  button.setAttribute('aria-pressed',
    String(button.getAttribute('aria-pressed') !== 'true'));
  draw();
});
draw();
// The host places the semantic button and composites source at 1:1 display cells.
```

For DOM-driven pages, use the complete `ui-pages.html` / `ui-pages.css` shell as the integration reference, replace the demo data controller, and retain `mountUIPagesSkin`. A component mount example is `mountReadinessComponent(host,'workflow',{refresh:()=>skin.relayout(),navigate,notify})`. Call its returned function before replacing the host. Do not import `ui-pages.js` into an unrelated document: it auto-mounts the application and expects its shell IDs.

## Workbench widgets

These IDs select `paintWidget(ctx,id,config)`. Configuration includes label, numeric range/value/step/unit, color, size, disabled state, variant, mark, notes, search query, three active flags and selected option. Use `normalizeWidget` or `normalizeBenchState` from `dist/bench-store.js` before accepting data. The existing interaction controller is `dist/workbench.js`; the painter itself has no listeners.

| Native ID | Component | Family |
| --- | --- | --- |
| `dial` | Rotary dial | Inputs |
| `wheel` | Encoder wheel | Inputs |
| `bar` | Progress bar | Feedback |
| `indicators` | Status indicators | Feedback |
| `slider` | Linear slider | Inputs |
| `percentage` | Percentage readout | Feedback |
| `search` | Search field | Inputs |
| `buttons` | Action buttons | Actions |
| `toggle` | Power toggle | Actions |
| `stepper` | Numeric stepper | Inputs |
| `level` | Level meter | Feedback |
| `segments` | Segmented selector | Actions |

Each widget's saved note is `widgets.<id>.notes` under `phosphor-component-workbench-v1`. Full default configurations are in the manifest, copied from `BENCH_CATALOG`.

## Assembled page components

| Native ID | Component | Page |
| --- | --- | --- |
| `hero` | Hero / mission banner | `home` |
| `news` | News cards | `home` |
| `updates` | System updates | `home` |
| `resources` | Resource list | `home` |
| `case-header` | Record header | `cases` |
| `tabs` | Section tabs | `cases` |
| `workflow` | Status stepper | `cases` |
| `actions` | Quick action guide | `cases` |
| `filters` | Filter panel | `parts` |
| `table` | Search / data table | `parts` |
| `pagination` | Pagination | `parts` |
| `forecast` | Inventory forecast | `parts` |
| `chart-legend` | Chart legend | `parts` |
| `metrics` | Metric summary | `value` |
| `stacked-bars` | Stacked comparison | `value` |
| `distribution` | Failure distribution | `value` |
| `insights` | Attention summary | `logistics` |
| `supply-status` | Supply risk list | `logistics` |
| `map` | Interactive map | `logistics` |
| `map-legend` | Map legend | `logistics` |
| `map-toolbar` | Layer controls | `logistics` |
| `alerts` | Alert drawer | `logistics` |
| `command-search` | Command search | `logistics` |

Readiness components export an individual mount through `mountReadinessComponent`. The seven logistics entries currently mount as one connected `mountLogistics` page; the existing catalog uses the internal `scopeComponent` helper in `ui-pages.js` to reveal a selected section and its dependent alerts/map. There is no exported `mountLogisticsComponent` API. Retain the whole page or explicitly extract its state/handlers when making independent widgets. A component's saved edit note is `notes.<id>` under `phosphor-ui-pages-v1`.

## SaaS charts and complete screens

`dist/saas.html?page=<view>` assembles six screens: `overview`, `fleet`, `inspections`, `analytics`, `components`, and `workspace`. The manifest keeps these in one page entry with a `views` array and `viewQueryParameter: "page"`. Its controller owns the shell and is not an exported mount function. Use `dist/ui-pages.css` and `dist/saas.css`; retain one page compositor.

The SaaS screens use deterministic demo fixtures from `dist/saas-state.js`. Fleet search/status filters, inspection review notes/status, analytics scope/export, instrument edits, and workspace preferences are local prototype interactions. There is no connected aircraft transport, shared account database, invitation service or billing integration. The product plan is in `SAAS-PLAN.md`.

| Native chart type | Element | Input |
| --- | --- | --- |
| `line` | Trend graph | `data` and optional aligned `series` |
| `bar` | Horizontal bar graph | Category `data`, optional per-item colors |
| `donut` | Distribution ring | Non-negative category shares in `data` |
| `gauge` | Radial meter | `value`, `max`, optional `target`, `unit` |
| `heatmap` | Activity matrix | `data` and `columns` |
| `sparkline` | Compact trend | `data`, optional selection |
| `bullet` | Linear meter | `value`, `max`, optional `target`, `unit` |

`paintVFDChart(ctx,width,height,spec)` paints at its final integer display-pixel dimensions; it does not create a shader. `normalizeVFDChart(spec)` sanitizes values, bounds and colors. `formatVFDValue(value,unit)` formats display readouts. `vfdChartDomain(spec)` computes a finite plotting domain and `hitVFDChart(spec,width,height,x,y)` maps display-pixel coordinates to a data index.

For an interactive component, call `bindVFDChart(canvas,{getSpec,onSelect,refresh})`. It assigns `canvas.vfdDraw`, labels and keyboard behavior; `onSelect` receives `{index,label,value,event}`. Update the host specification and call the returned `refresh()` after programmatic changes, so the visible chart and accessible label agree. Call `destroy()` before removing the canvas. The binder does not save state or create a render loop. The host's `refresh` callback should call `skin.refresh()`.

Workspace state is normalized by `normalizeSaasState`. `loadSaasState(storage)` and `saveSaasState(state,storage)` return `{state,error?,cause?}`; do not claim persistence when `error` is present. Use `filterFleet`, `filterInspections`, `updateInspection`, and `getDashboardData` to drive the demo. Review changes are immutable state updates. Per-chart edit notes live in `componentNotes.<type>` under `phosphor-saas-workspace-v1`; table searches, chart selection and the live value slider are transient.

## Raster types and reference buttons

The manifest's `vfd.*` entries list `data-vfd` values and input attributes. Generic types are label, panel, button, search, select, slider, time, capture, transport-key, thermal-ramp and alert. Spatial/editor types add compass, histogram, lasso-overlay and marker flag/tether/panel. Drone types add panel/header/heading/altitude/attitude/feed. Direct Operate adds stick/frame/hud. The `canvas` extension belongs to the page skin.

Transport-key icons use the element's **ID**, not a `data-transport` field: stop/stop-playback, play/play-pause, previous/step-back and next/step-forward. The painter `playing` argument decides play versus pause.

Position-setting artwork uses `REFERENCE_BUTTONS` (21 entries): F1-F4; eight explicit channel ON/OFF keys; up/left/SET/right/down; A-1 through D-4 selectors. `activateReference(state,id)` returns normalized next state. X/Y are integer hundredths of a millimetre. The transport artwork uses Stop, Previous, Play/Pause and Next, with `activateTransport` and `advanceTransport`. Both reference artworks use 256 x 128 logical pixels. The physical MN12864K optical simulation has its own 128 x 64 matrix; these are separate coordinate spaces.

## Drone and viewer wiring

`createCubeViewer` owns rendering and exposes `setDirectOperate`, `setDroneInput`, `clearDroneInput` and `setDirectOperateLayout`, alongside camera, map, asset, layer, voxel and point-edit commands. See the manifest for the complete method and callback lists. The existing `dist/viewer.js` shows orchestration with the flag, gauge cluster, Direct Operate panel and VFD skin.

`mountDroneCluster` consumes finite heading/yaw/roll/pitch/altitude values. Direct controls additionally require speed. Optional GPS uses latitude/longitude in degrees. Attitude uses degrees; altitude uses metres and speed uses metres/second. The old `onLocate` option is accepted but unused by the current cluster; use `onDirectOperate` for manual mode.

The input object is `{yaw,lift,forward,strafe}`, each clamped to -1..1. Left stick is yaw/lift; right stick is strafe/forward. Heading 0 is north (-Z), 90 is east (+X); positive yaw is clockwise, lift is upward, forward is body-forward and strafe is body-right. Positive roll banks right and positive pitch raises the nose. The pure `createDroneFlight` model integrates in metres at 120 Hz. Map projection and geometry zoom supply `metersToWorld` only when positioning the rig/cameras.

Direct Operate uses separate chase, north-up overhead and FPV cameras within the same renderer. UI emits inset rectangles normalized 0..1 to the main canvas, top-left origin. Input must neutralize on release, cancel, lost capture, blur, hidden tab and destruction. Renderer blur/hidden handling also halts velocity and resets the flight clock. Exiting holds the current flown position and restores the prior map camera/projector. These APIs are a local simulation and have no flight-hardware transport.

Every mount/renderer has an explicit `destroy`, `dispose` or cleanup return. Call it to release observers, listeners, animation frames, GPU resources and in-flight work. Do not retain destroyed module instances.

## Saved state boundaries

The manifest lists all eleven active browser storage keys and their normalizers. Active optical settings and named optical libraries are separate. Workbench optics supply defaults for the viewer and UI pages; UI pages can override their own optics. Saved state is origin-local: the hosted Site, `localhost` and `127.0.0.1` may all differ.

Preserve any `-recovery` entries separately as raw recovery data. A store's normalized state is not evidence that a missing browser key was explicitly saved. Existing stores do not persist the current selection, undo stack, transient drone pose, open overlays, live OSM cache or an in-memory color bake. Do not describe those as restored from a settings snapshot unless the handoff adds and verifies a separate capture.

The current project backup envelope is version 3: eleven active storage keys plus three recovery keys. Versions 1 and 2 remain accepted and restore only their original twelve and thirteen keys; even replace mode leaves newer designer state untouched, and version 1 also preserves SaaS state. `project-backup.schema.json` and `parseProjectBackup` define the three contracts. New captures include both the SaaS workspace and layout designer keys.

The readiness/logistics mounts currently own their local demo records. Replacing those with an application's backend is an integration task, not accomplished by copying a component's visual code.

## Runtime, assets and notices

Serve over HTTP; file URLs are unsuitable for ESM/worker/data loading. WebGL 2, Canvas 2D, ResizeObserver and Pointer Events are used. Source dependencies are vendored and imports are relative, including version query strings; preserve paths or rewrite them consistently when bundling. The full viewer expects its worker and asset chunks at their existing relative locations.

| Item | Notice / provenance | Reuse condition |
| --- | --- | --- |
| Three.js 0.187.0 | `dist/vendor/LICENSE`, `dist/vendor/README.md` | MIT; keep notice. Use the same Three instance for Spark and all scenes. |
| Spark 2.4.0 | `dist/vendor/SPARK-LICENSE`, `dist/vendor/SPARK-README.md` | MIT; keep notice. |
| Pumpkin! by Mavrick Hansen | `dist/assets/pumpkin-license.txt` | CC BY 4.0; bundled sample capture. |
| Shopping Center Trees MK by Natural Splats | `dist/imported-scenes.js` (payload not bundled) | CC BY 4.0; optional sample capture. |
| Jam and Cheese Croissant by Mateo Vallarino | `dist/imported-scenes.js` (payload not bundled) | CC BY-NC 4.0; noncommercial restriction applies to this optional capture. |
| OpenStreetMap data | `dist/hologram-map.js`, `dist/imported-scenes.js` is only the splat asset catalog | Keep © OpenStreetMap contributors attribution and follow the linked OSM license. Live Overpass data is not a durable offline map snapshot. |

UI reuse does not require distributing the sample Gaussian captures. See the root LICENSE for original UI code and THIRD_PARTY_NOTICES.md for dependencies and datasets. The generated Phosphor Pixel font follows the project's own glyph artwork; rebuild tooling is `tools/build-pixel-font.py`.

The optical layer model is a tunable visual study, not an electrical or calibrated spectral model. OSM geometry may use estimated heights and styled colors. Readiness/logistics records, drone telemetry, thermal/depth previews and Direct Operate are explicitly demos. Preserve those distinctions when connecting a real program.

### SLAM replay in the viewer

The **SLAM replay** capture in `dist/viewer.html` replays a compatible user-supplied recording. Open one with **Open .mcap**, by dropping it on the view, or with `viewer.html?mcap=<url>` (the URL must allow this origin). `dist/mcap-replay.js` reads the container and payloads with `dist/vendor/scan-reader/` and fzstd for zstd chunks: the busiest `arachnid.sensor.DepthImage` stream, its `CameraInfo`, the `arachnid.geometry.PoseStamped` track (one to one when the counts match, else nearest in time) and the colour stream (JPEG frames decoded by the browser). Each depth frame is deprojected (up to 3,000 points, 0.3 to 6 m), carried into the world by its pose, coloured, and appended in time order, so frame k is the first `frames[k].end` points. `buildReplay(bytes)` and `buildReplayAsync(bytes)` return `{frames, positions, colors, trail, bounds, duration, posed, coloured, topics, pointCount}`; `frameAt(replay, progress)` gives the frame whose time has come.

`dist/mcap-replay-scene.js` draws it in the renderer as a native scene: the cloud so far, the frame being added lit in phosphor, the camera's trail and its frustum at the current pose, fitted to the stage. The timeline runs in recording time; step buttons move one recorded frame. Nothing is uploaded: the file is read in the page.

### Scans and replays under the hologram projector

The city viewer's hologram (`dist/hologram-map.js`) now draws three kinds of source with the same controls: projector aim, cone, height, brightness, edge, path glow (the rays to the source) and falloff, map scale, pan inside the circle and orbit outside it, the compass, and the drone's demo orbit with Direct Operate. The SF waterfront is OpenStreetMap as before. **SLAM replay** and the scanned monuments set a point source with `setPointSource({positions, colors, count, label, outline, orbit, toLonLat, metresPerUnit})`: `buildPointVoxels` (`dist/hologram-voxels.js`) snaps the points to cells, each coloured by the mean of its points, the tops marked as edges, coarsened to the same 80,000-cell budget. A replay advancing calls `updatePointCount()`; its trail, frustum and current frame ride in the map's `overlays`.

**Arch of Constantine** (Rome) and **Cologne Cathedral** are optional, unbundled Funes scans (FUNES.WORLD, CC BY-NC 4.0: non-commercial, credit the authors). `tools/import-obj-scan.mjs` samples each published mesh (they carry no texture) into `dist/assets/scans/*.bin`, scaled and turned to match its OpenStreetMap outline (`dist/scan-sites.js`): the Arch at the OSM height of 21 m on its 167° axis, the Cathedral to its 145.2 m footprint length, towers to the west, on its 1.8° axis. Each scan's real outline is drawn under it in orange; the drone's coordinates are the real site's. `dist/scan-source.js` fits a scan or a replay under the projector with metres in proportion.

### UI and flow designer

`dist/blank.html?page=home` provides seven main design pages: Home, Site, Cases, Assets, System, Calendar and Analyze. Assets is scoped to planes, tanks and sites; System is scoped to topology, modules, telemetry and direct control. The left rail groups every page under these seven main pages, with separate disclosure buttons and an **Expand All** control. The full outline exposes all 26 pages. **Manage pages** below the rail separator opens the page dialog and creates named custom pages. `dist/designer-navigation.js` exports `groupDesignPages(linkedPages)`; grouping is separate from the saved layout schema. Every page has an independent canvas. These are design surfaces, not connected operational screens; the authentication-named pages do not implement authentication.

The floating, draggable toolbox supports drawing grid-aligned rectangles and horizontal or vertical dividers, selecting, moving and resizing them, editing labels, deleting, undo/redo, and optional page links with a Follow action. Selection, labels and deletion work for both element types. Link targets include main tabs and hidden pages. Keyboard tools are V for Select, R for Rectangle, D for Divider, T for Label, Delete/Backspace for deletion, and Escape to cancel or clear selection. Left-rail page links support click, Up/Down, Home/End, browser history and direct page URLs. Right/Left expand or collapse groups and move between parent and child links. The rail scrolls independently and reveals the selected page. All labels and geometry pass through the existing shared VFD compositor; no separate per-control shader or stretched assets are used.

**UI preview** paints each recognized rectangle directly at its saved display-pixel bounds inside the designer's existing framebuffer, with the same window-wide grid and VFD shader. Unrecognized rectangles retain their wireframe representation. Preview interaction state is transient and does not mutate the saved geometry, labels or page links. **Edit layout** returns to the original authoring view.

The preview has two synthetic data adapters selected with the `data` query parameter. **atlas** is the default detailed topology and page fixture set, retained under its historical adapter name. **demo** uses the original compact examples. All topology, status, telemetry, findings and execution results are invented for visual testing. The panel map describes demo bindings, not an internal product roadmap. Neither adapter fetches data, signs anyone in or controls a device.

`dist/designer-preview.js` dispatches and exports `hasDesignElement(rect, page)`, `paintDesignElement(ctx, rect, {page, allRects})` and `activateDesignElement(rect, {x, y}, {page, allRects})`, with the same signatures as before. Painters accept saved UI-cell bounds and return whether the label was recognized; activation coordinates are normalized from 0 to 1 inside the rectangle, and the return value is `true` (repaint), `false`, or `{navigate: pageId}`, which the designer follows. Pass the page's full element array as `allRects` to preserve nested panel regions. Label matching trims, folds case and collapses whitespace. With atlas a box finds the painter of its own page first (`page/label`), then a shared one: step boxes (`step 3: simulate`), `return` and `next`, view tabs (`view: chains`), and any linked box. The manifest lists the registered atlas panels and the 21 names the demo recognizes. The copied painter dependency tree lives under `dist/sandbox-ui/src`; the standalone interactive element gallery also includes its stage and input adapters at `dist/sandbox-ui/elements.html`.

The layout to import is `handoff/designer/arachnid.flow-design.json`, built by `tools/build-designer-layout.mjs` from the shipped demo layout: it keeps every box of the owner's as it is and adds the outline of `dist/designer-outline.js` (the six steps of a flight inside Site, the four views of System, the Device page, and the pages beside the flow). Run it again on a newer export with `--base`; it never moves a box that exists.

With atlas, System draws the topology in its `topology` rectangle (or, without one, in the space left of the saved sidebar), the command path and, on System: chains, the chains of modules, all through `dist/designer-arch-view.js`. Tiers sit in rows on one column grid; links run only in the channels between rows and the lanes between columns, never through a node; nodes step down from full to medium to compact, then the tiers go on pages. One selection is shared by the diagrams and the System panels. Operator and Observer replace Admin and Viewer: they only show what the lease of a robot would allow, and the Observer's management buttons do nothing. With demo, the three topology exports forward to `dist/designer-topology.js`.

`dist/designer-topology.js` (the demo adapter) exports `paintSystemTopology(ctx, bounds)`, `activateSystemTopology(point, bounds)` and `getSystemTopologyState()`. Here both `bounds: {x, y, width, height}` and `point: {x, y}` use display pixels, not UI cells or normalized coordinates. Activation returns whether selection or role changed; repaint the graph and dependent panels afterward. The state getter returns `{selected, accessRole}`; `selected` is frozen metadata with `{id, name, type, subtype, model, location, sensors, modules}`. Node selection and access role live only in module-local demo state and are not part of layout exports or backups. The topology module makes no network requests and sends no device commands.

Layouts save per page under the unchanged key `phosphor-flow-designer-v1`. Export/Import exchanges a `phosphor-flow-designer` version 2 document independently of full project backups. `dist/blank-state.js` exposes `DESIGN_PAGES`, `DEFAULT_HIDDEN_PAGES`, `DESIGN_STORAGE_KEY`, `createDefaultDesign`, `normalizeDesign`, `readDesign` and `saveDesign`.

The document is `{format, version: 2, hiddenPages, pages}`. `hiddenPages` contains `{id, label}` definitions; `pages` contains an array for each main and hidden page ID. Each element is `{id, type, x, y, width, height, label, link}`, where `type` is `rectangle` or `divider`. Geometry uses integer UI-cell coordinates (eight display pixels per UI cell), within a 512 by 512 cell canvas. Rectangles are at least four cells wide and three cells high. A horizontal divider has height 1 and width at least 4; a vertical divider has width 1 and height at least 4. Element labels may contain up to 80 characters; a `link` is an existing main or hidden page ID, or `null`.

The document allows at most 32 hidden pages and 200 elements per page. Hidden page IDs match `[a-z0-9]+(?:-[a-z0-9]+)*`, have a maximum length of 64, and cannot collide with main pages or reserved object/document names. Hidden labels are trimmed, nonempty strings of at most 40 characters without control characters. `createDefaultDesign()` includes blank `sign-in`, `sign-up` and `reset-password` pages. Version 1 imports are strictly validated before migration: existing rectangles gain `type: 'rectangle'`, and the three default hidden pages are added. Version 2 import validates all page definitions, arrays, element geometry and link targets before replacing the document. Reading migrates in memory without writing storage; the next successful save writes version 2. `readDesign` reports blocked or malformed storage without overwriting the original; hosts should expose that failure and retain edits in the session until the user repairs or replaces the saved document.

The saved document includes hidden-page definitions, element types, labels, geometry and flow targets. Current tool, selection, dragging and undo/redo history are transient UI state. `defaultProjectSettings().designer` supplies independent empty arrays for seven main pages and three default hidden pages. The version 3 full project backup preserves the exact stored designer string without migrating or normalizing its contents; migration occurs when the designer loads a version 1 layout.
