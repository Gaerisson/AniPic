import { parentPort, workerData } from "node:worker_threads";
import sharp from "sharp";
import { promises as fs, constants } from "node:fs";
import path from "node:path";
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";

export const MODEL = "studioludens/birefnet-lite-512";
export const REVISION = "962e67969ec6acec9c19fab76acee4f5e22e990c";
if (parentPort) {
  try {
    env.cacheDir = workerData.cacheDir;
    env.allowLocalModels = false;
    await fs.mkdir(workerData.cacheDir, { recursive: true });
    await fs
      .copyFile(
        new URL("../THIRD_PARTY_NOTICES.txt", import.meta.url),
        path.join(workerData.cacheDir, "THIRD_PARTY_NOTICES.txt"),
        constants.COPYFILE_EXCL,
      )
      .catch((e) => {
        if (e.code !== "EEXIST") throw e;
      });
    const options = {
      revision: REVISION,
      progress_callback: (p) => {
        if (p.status === "progress")
          parentPort.postMessage({
            progress: Math.round(p.progress || 0),
            stage: "Téléchargement du modèle",
            file: p.file?.split("/").at(-1),
          });
      },
    };
    const model = await AutoModel.from_pretrained(MODEL, {
      ...options,
      dtype: "fp32",
      device: "cpu",
      session_options: {
        intraOpNumThreads: 2,
        interOpNumThreads: 1,
        enableCpuMemArena: false,
        enableMemPattern: false,
      },
    });
    const processor = await AutoProcessor.from_pretrained(MODEL, options);
    parentPort.postMessage({ stage: "Détourage de l’animal…", progress: null });
    const { data, info } = await sharp(Buffer.from(workerData.image), {
      limitInputPixels: 40e6,
    })
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = new RawImage(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      info.channels,
    );
    const { pixel_values } = await processor(image);
    const prediction = await model({ input_image: pixel_values });
    const output_image = prediction.logits || prediction.output_image;
    const mask = await RawImage.fromTensor(
      output_image[0].sigmoid().mul(255).to("uint8"),
    ).resize(image.width, image.height);
    const png = await sharp(data, { raw: info })
      .joinChannel(Buffer.from(mask.data), {
        raw: { width: info.width, height: info.height, channels: 1 },
      })
      .png()
      .toBuffer();
    await model.dispose();
    parentPort.postMessage({ result: png });
  } catch (error) {
    parentPort.postMessage({
      error:
        "Le moteur de détourage n’a pas abouti. Vérifiez la mémoire disponible et l’accès à Hugging Face au premier lancement.",
      diagnostic: String(error.message).slice(0, 300),
    });
  }
}
