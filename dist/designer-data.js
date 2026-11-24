// Public visual preview adapters. Both contain synthetic data; neither fetches or commands devices.
// The atlas name is retained as a stable query parameter for previously saved links.
export const PREVIEW_DATA_MODES = Object.freeze(['atlas', 'demo']);
function fromAddress() {
  try { const asked = new URLSearchParams(globalThis.location?.search ?? '').get('data'); return PREVIEW_DATA_MODES.includes(asked) ? asked : 'atlas'; }
  catch { return 'atlas'; }
}
let mode = fromAddress();
export const previewData = () => mode;
export function setPreviewData(next) {
  if (!PREVIEW_DATA_MODES.includes(next)) throw new RangeError(`Unknown preview adapter: ${JSON.stringify(next)}`);
  mode = next;
}
