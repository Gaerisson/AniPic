import { z } from "zod";
import { showDefaults } from "../shared/signage.mjs";
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const showSchema = z
  .object({
    orientation: z.enum(["landscape", "portrait"]),
    style: z.enum(["editorial", "glass", "cinema", "cards"]),
    motion: z.enum(["off", "gentle", "3d"]),
    intensity: z.number().int().min(0).max(100),
    transition: z.enum(["fade", "slide", "zoom"]),
    photoSeconds: z.number().int().min(3).max(30),
    photosPerAnimal: z.number().int().min(1).max(8),
    includeVideos: z.boolean(),
    videoSeconds: z.number().int().min(3).max(60),
    species: z
      .array(z.enum(["dog", "cat", "other"]))
      .min(1)
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    maxAnimals: z.number().int().min(1).max(200),
    introSeconds: z.number().int().min(0).max(15),
    statsEvery: z.number().int().min(0).max(50),
    statsEnabled: z.boolean(),
    pace: z.enum(["gentle", "dynamic"]),
    logoAnimation: z.enum(["fade", "mosaic"]),
    particleDensity: z.number().int().min(0).max(100),
    particleSpeed: z.number().int().min(0).max(100),
    rotationMinutes: z.number().int().min(0).max(60),
    excludedScenes: z.array(z.string().min(1).max(150)).max(2500),
    logoPhotoBlend: z.number().int().min(0).max(85),
    sceneOrder: z
      .array(z.string().min(1).max(150))
      .max(2500)
      .refine((v) => new Set(v).size === v.length),
    sceneDurations: z
      .record(z.string().min(1).max(150), z.number().int().min(3).max(120))
      .refine((v) => Object.keys(v).length <= 2500),
    inserts: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            type: z.enum(["message", "video", "stats", "logo", "hours", "spa"]),
            afterAnimal: z.number().int().min(0).max(200),
            seconds: z.number().int().min(3).max(120),
            title: z.string().trim().max(100).default(""),
            body: z.string().trim().max(350).default(""),
            theme: z
              .enum([
                "auto",
                "classic",
                "halloween",
                "christmas",
                "summer",
                "easter",
              ])
              .default("classic"),
            assetId: z.string().uuid().optional(),
          })
          .strict(),
      )
      .max(40)
      .refine((v) => new Set(v.map((b) => b.id)).size === v.length),
    statsSeconds: z.number().int().min(3).max(20),
    logoEvery: z.number().int().min(0).max(100),
    showFacts: z.boolean(),
    showQr: z.boolean(),
    year: z.number().int().min(2000).max(2100),
    mode: z.enum(["reception", "wallpaper"]),
    title: z.string().trim().max(80),
    scheduleEnabled: z.boolean(),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTime: time,
    endTime: time,
  })
  .strict();
export const parseShow = (v = {}) =>
  showSchema.parse({ ...showDefaults, ...v });
