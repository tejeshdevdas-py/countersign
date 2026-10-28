/**
 * Countersign: keep the vendored drawio viewer on this machine.
 *
 * `vendor/drawio/viewer-static.min.js` is local, but when its location globals
 * are unset it fetches stencil and shape libraries, styles, images, the math
 * renderer and a proxy from viewer.diagrams.net, and it loads the web fonts a
 * diagram names (usually fonts.googleapis.com). Under LOCAL_ONLY:
 *   - every location global points into a folder that does not exist beside the
 *     app page, so those loads fail on the machine: library shapes (AWS, Cisco,
 *     electrical, ...) draw as placeholders;
 *   - `Editor.GOOGLE_FONTS` gets the same local prefix, and a font URL with a
 *     scheme or `//` is dropped, so text falls back to an installed font.
 * Remote JavaScript was never run: the viewer sets `mxStencilRegistry.allowEval`
 * to false when it loads.
 */

/** Folder name the viewer's locations point into. It is never shipped. */
export const DRAWIO_OFFLINE_BASE = 'drawio-offline-unavailable';

/** The globals the viewer defaults to https://viewer.diagrams.net (first lines of the script). */
export const DRAWIO_LOCATION_GLOBALS: Readonly<Record<string, string>> = {
  PROXY_URL: `${DRAWIO_OFFLINE_BASE}/proxy`,
  STYLE_PATH: `${DRAWIO_OFFLINE_BASE}/styles`,
  SHAPES_PATH: `${DRAWIO_OFFLINE_BASE}/shapes`,
  STENCIL_PATH: `${DRAWIO_OFFLINE_BASE}/stencils`,
  DRAW_MATH_URL: `${DRAWIO_OFFLINE_BASE}/math4/es5`,
  GRAPH_IMAGE_PATH: `${DRAWIO_OFFLINE_BASE}/img`,
  mxImageBasePath: `${DRAWIO_OFFLINE_BASE}/mxgraph/images`,
  mxBasePath: `${DRAWIO_OFFLINE_BASE}/mxgraph/`,
};

const REMOTE_URL = /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/** True for a URL that names a host: `https://x`, `http://x`, `//x`. */
export function isRemoteFontUrl(url: unknown): boolean {
  return typeof url === 'string' && REMOTE_URL.test(url);
}

type AddFont = (name: string, url: string | null, ...rest: unknown[]) => unknown;

interface DrawioViewerGlobals {
  Editor?: { GOOGLE_FONTS?: string; GOOGLE_FONTS_CSS2?: string };
  Graph?: { addFont?: AddFont; prototype?: { addExtFont?: AddFont } };
  GraphViewer?: { processElements?: () => void };
  onDrawioViewerLoad?: () => void;
}

/** Runs once the viewer has loaded: no web fonts from a remote host. */
export function restrictDrawioFonts(target: DrawioViewerGlobals): void {
  const { Editor, Graph } = target;
  if (Editor) {
    Editor.GOOGLE_FONTS = `${DRAWIO_OFFLINE_BASE}/fonts/css?family=`;
    Editor.GOOGLE_FONTS_CSS2 = `${DRAWIO_OFFLINE_BASE}/fonts/css2?family=`;
  }
  const addFont = Graph?.addFont;
  if (Graph && addFont) {
    // A null URL makes the viewer skip the font and still call any callback.
    Graph.addFont = function (this: unknown, name, url, ...rest) {
      return addFont.call(this, name, isRemoteFontUrl(url) ? null : url, ...rest);
    };
  }
  const addExtFont = Graph?.prototype?.addExtFont;
  if (Graph?.prototype && addExtFont) {
    Graph.prototype.addExtFont = function (this: unknown, name, url, ...rest) {
      return addExtFont.call(this, name, isRemoteFontUrl(url) ? null : url, ...rest);
    };
  }
}

/**
 * Call before the viewer script is injected. The viewer calls
 * `onDrawioViewerLoad` instead of `GraphViewer.processElements()` at the end of
 * its load, so the hook restricts fonts and then does that scan itself.
 */
export function applyDrawioOfflineGlobals(target: Window): void {
  const globals = target as unknown as Record<string, unknown> & DrawioViewerGlobals;
  for (const [name, value] of Object.entries(DRAWIO_LOCATION_GLOBALS)) {
    globals[name] = value;
  }
  globals.onDrawioViewerLoad = () => {
    restrictDrawioFonts(globals);
    globals.GraphViewer?.processElements?.();
  };
}
