import { readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { audit, settings, saveSettings } from "./db.mjs";
const keyFile = (c) => path.join(c.dbDir, ".mistral-key");
export function audioConfig(c, db) {
  let stored = "";
  try {
    stored = readFileSync(keyFile(c), "utf8").trim();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const s = settings(db);
  return {
    key: c.mistralApiKey || stored,
    source: c.mistralApiKey ? "environment" : stored ? "interface" : "none",
    ttsModel: s.audioTtsModel || c.mistralTtsModel,
    sttModel: s.audioSttModel || c.mistralSttModel,
    voiceId: s.audioVoiceId || c.mistralTtsVoiceId || "",
  };
}
export async function registerAudioSettings(app, { db, c, authorized }) {
  const view = () => {
    const { key, ...v } = audioConfig(c, db);
    return { ...v, configured: !!key };
  };
  app.get("/api/admin/audio", { preHandler: authorized(["admin"]) }, async () =>
    view(),
  );
  app.put(
    "/api/admin/audio",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const v = z
        .object({
          apiKey: z
            .string()
            .trim()
            .max(500)
            .regex(/^[\x21-\x7e]*$/)
            .optional(),
          removeKey: z.boolean().default(false),
          ttsModel: z.string().regex(/^[\w.-]{1,100}$/),
          sttModel: z.string().regex(/^[\w.-]{1,100}$/),
          voiceId: z.string().regex(/^[\w-]{0,100}$/),
        })
        .strict()
        .parse(req.body);
      if (v.apiKey || v.removeKey) {
        const temporary = keyFile(c) + ".tmp";
        writeFileSync(temporary, v.removeKey ? "" : v.apiKey, {
          encoding: "utf8",
          mode: 0o600,
        });
        renameSync(temporary, keyFile(c));
      }
      saveSettings(db, {
        audioTtsModel: v.ttsModel,
        audioSttModel: v.sttModel,
        audioVoiceId: v.voiceId,
      });
      audit(db, req.user, "audio_configured", {
        keyChanged: !!v.apiKey || v.removeKey,
      });
      return view();
    },
  );
}
