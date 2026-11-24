// The designer's UI PREVIEW dispatcher: blank.js asks it whether a saved box has a preview, to paint
// it, and to pass it a click. With the 'demo' adapter everything goes to today's designer-elements.js,
// unchanged; with 'atlas' (the default) a box goes to the painter registered for its name in
// designer-panels/, and a box with no painter stays a wireframe, as before. The three exports keep
// designer-elements.js's names and arguments, so blank.js changes only its import line.
import * as demo from './designer-elements.js';
import {previewData} from './designer-data.js';
import {hasPanel, paintPanel, activatePanel} from './designer-panels/index.js';

export {previewData, setPreviewData, PREVIEW_DATA_MODES} from './designer-data.js';

/** True when the box has a preview on this page. */
export function hasDesignElement(rect, page) {
  return previewData() === 'demo' ? demo.hasDesignElement(rect, page) : hasPanel(rect, page);
}

/** Paints a box at its saved bounds (UI cells); false when it has no preview. */
export function paintDesignElement(ctx, rect, options = {}) {
  return previewData() === 'demo' ? demo.paintDesignElement(ctx, rect, options) : paintPanel(ctx, rect, options);
}

/**
 * A click at {x, y} (0 to 1 inside the box). Returns false when nothing changed, true when the
 * preview should repaint, or {navigate: pageId} to open a page, which blank.js already follows.
 */
export function activateDesignElement(rect, point, options = {}) {
  return previewData() === 'demo' ? demo.activateDesignElement(rect, point, options) : activatePanel(rect, point, options);
}
