import { audioConfig } from "./audio-settings.mjs";
import { z } from "zod";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { validateCues } from "../shared/subtitles.mjs";
import { assertStorage } from "./config.mjs";
import { audit } from "./db.mjs";
const exec = promisify(execFile),
  require = createRequire(import.meta.url);
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export function ffmpegPath(c) {
  if (c.ffmpegPath) return c.ffmpegPath;
  try {
    const pkg = `@remotion/compositor-${process.platform}-${process.arch}${process.platform === "win32" ? "-msvc" : process.platform === "linux" ? "-gnu" : ""}`;
    return path.join(
      path.dirname(require.resolve(pkg + "/package.json")),
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    );
  } catch {
    return "ffmpeg";
  }
}
export async function extractSpeech(c, asset) {
  assertStorage(c);
  const output = path.join(c.cacheDir, `speech-${randomUUID()}.wav`);
  try {
    await exec(
      ffmpegPath(c),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-i",
        path.join(c.mediaDir, asset.hash),
        "-map",
        "0:a:0",
        "-vn",
        "-t",
        "600",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        output,
      ],
      { windowsHide: true, timeout: 90000, maxBuffer: 64 * 1024 },
    );
    const stat = await fs.stat(output);
    if (stat.size > 20 * 1024 ** 2) throw fail("Piste audio trop volumineuse.");
    return await fs.readFile(output);
  } catch (e) {
    throw e.statusCode
      ? e
      : fail(
          "Impossible d’extraire la voix. Vérifiez la piste audio et FFMPEG_PATH.",
        );
  } finally {
    await fs.unlink(output).catch(() => {});
  }
}
export async function registerTranscription(app, { db, c, authorized }) {
  let active = false;
  app.post(
    "/api/video/transcribe",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 4, timeWindow: "1 minute" } },
    },
    async (req) => {
      const input = z
        .object({
          assetId: z.string().uuid(),
          offset: z.number().min(0).max(599).default(0),
          confirmUpload: z.literal(true),
        })
        .parse(req.body);
      if (!audioConfig(c, db).key)
        throw fail("Renseignez MISTRAL_API_KEY côté serveur.", 409);
      if (active) throw fail("Une transcription est déjà en cours.", 409);
      const asset = db
        .prepare("SELECT * FROM video_assets WHERE id=?")
        .get(input.assetId);
      if (!asset) throw fail("Piste introuvable.", 404);
      active = true;
      try {
        const audio = await extractSpeech(c, asset),
          body = new FormData();
        body.set("model", audioConfig(c, db).sttModel || "voxtral-mini-latest");
        body.set(
          "file",
          new Blob([audio], { type: "audio/wav" }),
          "narration.wav",
        );
        body.append("timestamp_granularities[]", "segment");
        const response = await (c.mistralFetcher || fetch)(
          "https://api.mistral.ai/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: "Bearer " + audioConfig(c, db).key },
            body,
            redirect: "error",
            signal: AbortSignal.timeout(120000),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw fail(
            "Transcription Mistral refusée. Vérifiez la clé et le quota.",
          );
        }
        let size = 0;
        const parts = [];
        for await (const part of response.body) {
          size += part.length;
          if (size > 1024 ** 2) {
            await response.body?.cancel().catch(() => {});
            throw fail("Transcription trop volumineuse.");
          }
          parts.push(part);
        }
        const data = JSON.parse(Buffer.concat(parts).toString());
        const cues = validateCues(
          (data.segments || [])
            .map((s) => ({
              start: Number(s.start) + input.offset,
              end: Math.min(600, Number(s.end) + input.offset),
              text: String(s.text || "").trim(),
            }))
            .filter((s) => s.text && s.end > s.start),
        );
        if (!cues.length)
          throw fail(
            "Aucun segment horodaté renvoyé. Vous pouvez importer un SRT ou saisir les sous-titres.",
          );
        audit(db, req.user, "video_transcribed", {
          assetId: asset.id,
          cues: cues.length,
        });
        return {
          cues,
          source: "mistral",
          text: String(data.text || "").slice(0, 10000),
        };
      } catch (e) {
        if (e.statusCode) throw e;
        throw fail(
          "Transcription interrompue. Aucun nouvel essai automatique.",
          502,
        );
      } finally {
        active = false;
      }
    },
  );
  app.addHook("preClose", async () => {
    while (active) await new Promise((r) => setTimeout(r, 50));
  });
}
