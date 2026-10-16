import { renderEditedPhoto } from "../shared/photo-edit.mjs";
let source;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      source?.close();
      source = data.bitmap;
      self.postMessage({ id: data.id, loaded: true });
      return;
    }
    if (!source) throw Error("Choisissez une photo.");
    const result = await renderEditedPhoto(
      (w, h) => new OffscreenCanvas(w, h),
      source,
      data.options,
      data.settings,
    );
    if (result.canvas) {
      const bitmap = result.canvas.transferToImageBitmap();
      self.postMessage(
        {
          id: data.id,
          bitmap,
          histogram: result.histogram,
          width: result.width,
          height: result.height,
        },
        [bitmap],
      );
    } else self.postMessage({ id: data.id, ...result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
