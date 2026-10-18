import {
  textDefaults,
  seasonDefaults,
  posterLayoutDefaults,
} from "../shared/content-defaults.mjs";
import { z } from "zod";
import { statusDefaults } from "../shared/animal-status.mjs";
import { photoRuleDefaults } from "../shared/photo-priority.mjs";
import { parseCron, validTimeZone } from "../shared/sync-schedule.mjs";
export const sourceDefaults = {
  syncScheduleMode: "interval",
  syncCron: "0 8,14,20 * * *",
  syncTimeZone: "Europe/Paris",
  spaRefugeUrl:
    "https://www.la-spa.fr/etablissement/refuge-spa-de-moree-jean-leriche/",
  spaRefugeSlug: "refuge-spa-de-moree-jean-leriche",
  spaApiUrl: "https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/",
  sourceScope: "spa:moree",
  sourceSpecies: ["dog", "cat", "other"],
  sourceAttempts: 3,
  sourceDelayMs: 2500,
  sourceTimeoutSeconds: 15,
  sourceMaxPages: 10,
  sourceMaxRequests: 60,
  sourceMaxDurationSeconds: 90,
  sourceMaxResponseMB: 5,
  sourceMinAnimals: 1,
  sourceMaxDropPercent: 20,
  sourceAllowPartial: true,
  sourceImportReserved: true,
  sourceRobotsPolicy: "respect",
  sourceStaleHours: 24,
  sourceAbsenceIntervalHours: 24,
  sourceMissingOutcome: "unconfirmed",
};
const httpsURL = z
  .string()
  .url()
  .max(500)
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && !u.port;
  }, "URL HTTPS sans identifiants ni port requise.");
export const sourceFields = {
  syncScheduleMode: z.enum(["manual", "interval", "cron"]).default("interval"),
  syncCron: z
    .string()
    .trim()
    .max(100)
    .refine((v) => {
      try {
        parseCron(v);
        return true;
      } catch {
        return false;
      }
    }, "Expression cron à cinq champs invalide.")
    .default(sourceDefaults.syncCron),
  syncTimeZone: z
    .string()
    .refine(validTimeZone, "Fuseau horaire invalide.")
    .default("Europe/Paris"),
  spaRefugeUrl: httpsURL.default(sourceDefaults.spaRefugeUrl),
  spaRefugeSlug: z
    .string()
    .regex(/^[a-z0-9-]{1,120}$/)
    .default(sourceDefaults.spaRefugeSlug),
  spaApiUrl: httpsURL.default(sourceDefaults.spaApiUrl),
  sourceScope: z
    .string()
    .regex(/^[a-zA-Z0-9:_-]{1,150}$/)
    .default("spa:moree"),
  sourceSpecies: z
    .array(z.enum(["dog", "cat", "other"]))
    .min(1)
    .max(3)
    .refine((v) => new Set(v).size === v.length, "Espèces dupliquées.")
    .default(sourceDefaults.sourceSpecies),
  sourceAttempts: z.number().int().min(1).max(5).default(3),
  sourceDelayMs: z.number().int().min(1000).max(10000).default(2500),
  sourceTimeoutSeconds: z.number().int().min(5).max(30).default(15),
  sourceMaxPages: z.number().int().min(1).max(50).default(10),
  sourceMaxRequests: z.number().int().min(1).max(150).default(60),
  sourceMaxDurationSeconds: z.number().int().min(15).max(180).default(90),
  sourceMaxResponseMB: z.number().int().min(1).max(10).default(5),
  sourceMinAnimals: z.number().int().min(1).max(1000).default(1),
  sourceMaxDropPercent: z.number().min(0).max(100).default(20),
  sourceAllowPartial: z.boolean().default(true),
  sourceImportReserved: z.boolean().default(true),
  sourceRobotsPolicy: z.enum(["respect", "spa_public_api"]).default("respect"),
  sourceStaleHours: z.number().int().min(1).max(48).default(24),
  sourceAbsenceIntervalHours: z.number().min(0.25).max(168).default(24),
  sourceMissingOutcome: z
    .enum(["unconfirmed", "adopted", "automatic", "after24h"])
    .default("unconfirmed"),
};
export const interfaceDefaults = {
  posterLayout: posterLayoutDefaults,
  textDefaults,
  seasonMessages: seasonDefaults,
  homeWidgets: ["photos", "clockWeather"],
  pageAccess: { broadcasts: "team", stats: "team", activity: "public" },
  glassEnabled: false,
  glassBlur: 16,
  glassOpacity: 82,
  glassSaturation: 130,
  photoRules: photoRuleDefaults,
  statusAppearance: statusDefaults,
  cardRadius: 18,
  photoRatio: "landscape",
  gridColumns: 0,
  gridGap: 20,
  photoZoom: 3,
  parallaxIntensity: 25,
  hoverSeconds: 1.8,
  hoverSlideshow: true,
  recentDays: 7,
  glowColor: "#ffbc79",
  fontScale: 100,
  motionSpeed: 100,
  showCardFacts: true,
  showPhotoCounts: true,
  defaultSort: "recent",
  defaultView: "grid",
};
export const interfaceFields = {
  posterLayout: z
    .object(
      Object.fromEntries(
        Object.entries(posterLayoutDefaults).map(([k, v]) => [
          k,
          z
            .object({
              x: z.number().min(0).max(90),
              y: z.number().min(5).max(94),
              size: z.number().min(14).max(90),
            })
            .strict()
            .default(v),
        ]),
      ),
    )
    .strict()
    .default(posterLayoutDefaults),
  textDefaults: z
    .object(
      Object.fromEntries(
        Object.entries(textDefaults).map(([k, v]) => [
          k,
          z.string().max(500).default(v),
        ]),
      ),
    )
    .strict()
    .default(textDefaults),
  seasonMessages: z
    .object(
      Object.fromEntries(
        Object.entries(seasonDefaults).map(([k, v]) => [
          k,
          z
            .object({
              title: z.string().max(100).default(v.title),
              body: z.string().max(350).default(v.body),
            })
            .strict()
            .default(v),
        ]),
      ),
    )
    .strict()
    .default(seasonDefaults),
  homeWidgets: z
    .array(
      z.enum([
        "photos",
        "clockWeather",
        "stats",
        "tv",
        "priorities",
        "activity",
        "agenda",
      ]),
    )
    .max(7)
    .refine((v) => new Set(v).size === v.length)
    .default(["photos", "clockWeather"]),
  pageAccess: z
    .object({
      broadcasts: z.enum(["team", "public"]).default("team"),
      stats: z.enum(["team", "public"]).default("team"),
      activity: z.enum(["team", "public"]).default("public"),
    })
    .strict()
    .default({ broadcasts: "team", stats: "team", activity: "public" }),
  glassEnabled: z.boolean().default(false),
  glassBlur: z.number().int().min(0).max(48).default(16),
  glassOpacity: z.number().int().min(35).max(95).default(82),
  glassSaturation: z.number().int().min(100).max(180).default(130),
  photoRules: z
    .object({
      sos: z.enum(["urgent", "high", "normal", "low"]).default("urgent"),
      reserved: z.enum(["urgent", "high", "normal", "low"]).default("low"),
      standard: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
    })
    .strict()
    .default(photoRuleDefaults),
  statusAppearance: z
    .object(
      Object.fromEntries(
        Object.entries(statusDefaults).map(([key, defaults]) => [
          key,
          z
            .object({
              label: z.string().trim().min(1).max(32).default(defaults.label),
              color: z
                .string()
                .regex(/^#[a-fA-F0-9]{6}$/)
                .default(defaults.color),
            })
            .strict()
            .default(defaults),
        ]),
      ),
    )
    .strict()
    .default(statusDefaults),
  cardRadius: z.number().int().min(0).max(32).default(18),
  photoRatio: z.enum(["landscape", "square", "portrait"]).default("landscape"),
  gridColumns: z.number().int().min(0).max(5).default(0),
  gridGap: z.number().int().min(8).max(36).default(20),
  photoZoom: z.number().min(0).max(10).default(3),
  parallaxIntensity: z.number().min(0).max(100).default(25),
  hoverSeconds: z.number().min(0.8).max(5).default(1.8),
  hoverSlideshow: z.boolean().default(true),
  recentDays: z.number().int().min(1).max(30).default(7),
  glowColor: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#ffbc79"),
  fontScale: z.number().int().min(90).max(115).default(100),
  motionSpeed: z.number().int().min(50).max(150).default(100),
  showCardFacts: z.boolean().default(true),
  showPhotoCounts: z.boolean().default(true),
  defaultSort: z.enum(["recent", "name", "photos", "oldest"]).default("recent"),
  defaultView: z.enum(["grid", "list"]).default("grid"),
};
