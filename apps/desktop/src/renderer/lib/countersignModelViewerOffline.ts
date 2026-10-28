/**
 * Countersign: keep `<model-viewer>` on this machine.
 *
 * @google/model-viewer loads its Draco and KTX2 decoders from www.gstatic.com
 * and its Lottie loader from cdn.jsdelivr.net, unless `self.ModelViewerElement`
 * names other locations before the first element is created. Under LOCAL_ONLY
 * those locations point into a folder that does not exist beside the app page,
 * so the load fails on the machine: a Draco- or KTX2-compressed model (or a
 * Lottie texture) does not render, and every other model renders as before.
 */

/** Folder name the locations point into. It is never shipped. */
export const MODEL_VIEWER_OFFLINE_BASE = 'model-viewer-offline-unavailable';

export const MODEL_VIEWER_OFFLINE_LOCATIONS = {
  dracoDecoderLocation: `${MODEL_VIEWER_OFFLINE_BASE}/draco/`,
  ktx2TranscoderLocation: `${MODEL_VIEWER_OFFLINE_BASE}/basis/`,
  lottieLoaderLocation: `${MODEL_VIEWER_OFFLINE_BASE}/lottie/LottieLoader.js`,
} as const;

interface ModelViewerConfigTarget {
  ModelViewerElement?: Record<string, unknown>;
}

/** Call with `self` before the first `<model-viewer>` element is created. */
export function configureModelViewerOffline(target: object): void {
  const config = target as ModelViewerConfigTarget;
  config.ModelViewerElement = {
    ...(config.ModelViewerElement ?? {}),
    ...MODEL_VIEWER_OFFLINE_LOCATIONS,
  };
}
