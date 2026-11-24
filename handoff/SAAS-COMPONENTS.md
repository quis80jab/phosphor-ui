# SaaS screens and raster instruments

Open `dist/saas.html` for the working prototype. All metrics and aircraft are deterministic demo data. Reviews, instrument notes, and workspace preferences save to `phosphor-saas-workspace-v1` in the current browser origin. There is no tenant backend, real telemetry connection, billing, or notification delivery.

## Screens

| Screen | Working interactions |
| --- | --- |
| Overview | Site and period filters, selectable volume and distribution charts, review drill-downs |
| Fleet | Search, status/site filters, sorting, aircraft details, related inspections |
| Inspections | Search, status/site filters, review status and note persistence |
| Analytics | Period/site filters, comparison toggle, point selection, CSV export |
| Instruments | Seven live chart types, value/color/pattern changes, saved edit notes, JSON spec export |
| Workspace | Profile and units, saved notification preferences, optical layers, product roadmap |

## Reuse a chart

Import `bindVFDChart` from `dist/saas-viz.js`. Supply a canvas inside a page that mounts `mountUIPagesSkin`. Use `canvas#ui-pages-gl` as the shared output and include `ui-pages.css`. Mark visible labels and controls with `data-vfd`. Do not mount a second compositor inside the same document.

```js
import { mountUIPagesSkin } from './ui-pages-skin.js';
import { bindVFDChart } from './saas-viz.js';

let spec = {
  type: 'line', title: 'Inspection coverage', unit: '%', max: 100,
  color: '#a9e9df',
  data: [{label: 'MON', value: 82}, {label: 'TUE', value: 94}],
  series: [{label: 'TARGET', color: '#ffc782', values: [95, 95]}]
};
const skin = mountUIPagesSkin({getState: () => ({mark: 'dots'})});
const chart = bindVFDChart(document.querySelector('#coverage'), {
  getSpec: () => spec,
  onSelect: ({index, label, value}) => {
    spec.selectedIndex = index;
    console.log(label, value);
  },
  refresh: () => skin.refresh()
});
// After programmatic changes:
spec = {...spec, color: '#89b9ef'};
chart.refresh(); // updates accessible values and redraws the shared display
// On removal: chart.destroy(); on page teardown: skin.destroy();
```

The binder attaches `canvas.vfdDraw(ctx, width, height)`. The compositor supplies final integer display-pixel dimensions and copies that canvas 1:1, without scaling a prebuilt asset. Size the native canvas in whole `UI_CELL` multiples; snap fractional grid tracks with `floorCell`. `PIXEL_PITCH` and `UI_CELL` are exported by `viewer-grid.js`.

| `type` | Data / options | Suggested display-pixel size |
| --- | --- | --- |
| `line` | `data`, optional `series`, `max`, `unit` | 300 × 160 |
| `bar` | `data` categories; negative values supported | 240 × 140 |
| `donut` | Nonnegative category `data` | 260 × 160, or compact below 260 wide |
| `gauge` | `value`, positive `max`, optional `target`, `unit` | 120 × 100 |
| `heatmap` | `data`, optional `columns` (default 7) | 240 × 140 |
| `sparkline` | `data`, optional `selectedIndex` | 80 × 28 |
| `bullet` | `value`, positive `max`, optional `target`, `unit` | 180 × 48 |

Data items use `{label, value, color?}`. Explicit item colors override the chart color. Comparison series use `{label, color, values}`. `selectedIndex` controls the selected data point; pointer and arrow/Home/End keys are supported. Gauge and bullet values are set by the host; their canvases are readouts rather than draggable controls. `showLabels: false` hides plot labels. Empty data draws a no-data state. Inputs are normalized to finite bounded values.

Additional exports: `paintVFDChart`, `normalizeVFDChart`, `hitVFDChart`, `vfdChartDomain`, `formatVFDValue`, `VFD_CHART_TYPES`, and `VFD_CHART_COLORS`. Pure drawing uses integer pixels, bitmap glyphs, sparse fills, and segmented rings, with no SVG or vector text.

Instrument JSON exports include `spec`, `renderer` (pattern, optics, and grid dimensions), and the saved edit note. This is data for your host program; it is not a second renderer or an automatic importer. Workspace exports contain normalized local state. Full-project backups version 2 include the SaaS store; version 1 backups still restore without touching it.

## Service boundary

The example state model is `saas-state.js`. Replace its deterministic fixtures with an authorized data adapter when building a connected service. Keep drawing independent from tenant/auth/transport code. Follow [SAAS-PLAN.md](SAAS-PLAN.md) for roles, records, and implementation gates before treating the prototype as production software.
