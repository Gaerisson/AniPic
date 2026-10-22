export const showDefaults = Object.freeze({
  orientation: "landscape",
  style: "editorial",
  motion: "gentle",
  intensity: 35,
  transition: "fade",
  photoSeconds: 6,
  photosPerAnimal: 3,
  includeVideos: true,
  videoSeconds: 18,
  species: ["dog", "cat", "other"],
  tags: [],
  maxAnimals: 60,
  introSeconds: 5,
  statsEvery: 4,
  statsEnabled: true,
  inserts: [],
  sceneOrder: [],
  sceneDurations: {},
  logoPhotoBlend: 65,
  logoAnimation: "fade",
  particleDensity: 35,
  particleSpeed: 40,
  particleStyle: "auto",
  backgroundTheme: "classic",
  rotationMinutes: 5,
  excludedScenes: [],
  pace: "gentle",
  statsSeconds: 6,
  logoEvery: 8,
  showFacts: true,
  showQr: true,
  year: new Date().getFullYear(),
  mode: "reception",
  connectionBadge: true,
  debugBadge: false,
  title: "",
  scheduleEnabled: false,
  days: [1, 2, 3, 4, 5, 6, 0],
  startTime: "09:00",
  endTime: "19:00",
});
export const showStyles = [
  {
    id: "editorial",
    name: "Éditorial",
    detail: "Portrait généreux, fiche claire",
  },
  {
    id: "glass",
    name: "Liquid glass",
    detail: "Panneau translucide et lumière douce",
  },
  {
    id: "cinema",
    name: "Cinéma",
    detail: "Photo immersive et typographie ample",
  },
  {
    id: "cards",
    name: "Galerie 3D",
    detail: "Cartes en relief, mouvement mesuré",
  },
];
export const showSize = (orientation) =>
  orientation === "portrait"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
export function showTimeline(show, fps = 24) {
  const p = { ...showDefaults, ...show.program },
    scenes = [];
  let cursor = 0,
    animalCount = 0;
  const add = (type, seconds, extra = {}) => {
    const duration = Math.max(1, Math.round(seconds * fps));
    const key = extra.block
      ? `insert:${extra.block.id}`
      : extra.key || `${type}:${scenes.length}`;
    scenes.push({ type, start: cursor, duration, ...extra, key });
    cursor += duration;
  };
  const finish = () => {
    const byKey = new Map(
      scenes
        .filter((s) => !(p.excludedScenes || []).includes(s.key))
        .map((s) => [s.key, s]),
    );
    const ordered = [];
    for (const key of p.sceneOrder || []) {
      if (byKey.has(key)) {
        ordered.push(byKey.get(key));
        byKey.delete(key);
      }
    }
    ordered.push(...byKey.values());
    let start = 0;
    for (const scene of ordered) {
      const custom = p.sceneDurations?.[scene.key];
      if (Number.isFinite(custom)) {
        const limit =
          scene.media?.kind === "video" ? scene.media.duration || 120 : 120;
        scene.duration = Math.max(
          1,
          Math.round(Math.min(Math.max(3, custom), limit) * fps),
        );
      }
      scene.start = start;
      start += scene.duration;
    }
    return {
      scenes: ordered.length
        ? ordered
        : [{ type: "logo", key: "empty", start: 0, duration: 5 * fps }],
      frames: Math.max(1, start || 5 * fps),
    };
  };
  if (p.introSeconds > 0) add("logo", p.introSeconds, { key: "intro" });
  if (p.mode === "wallpaper") {
    add("wallpaper", Math.max(8, p.photoSeconds * 2), { key: "wallpaper" });
    return finish();
  }
  const inserted = new Set();
  const insertAt = (n, remaining = false) => {
    for (const block of p.inserts || []) {
      if (inserted.has(block.id) || (!remaining && block.afterAnimal !== n))
        continue;
      inserted.add(block.id);
      if (block.type === "stats" && !p.statsEnabled) continue;
      const media =
        block.type === "video" ? show.insertMedia?.[block.assetId] : null;
      if (block.type === "video" && !media) continue;
      add(
        block.type,
        media
          ? Math.min(block.seconds, media.duration || block.seconds)
          : block.seconds,
        { block, media },
      );
    }
  };
  insertAt(0);
  for (const species of p.species) {
    const group = show.items
      .filter((a) => a.species === species)
      .slice(0, Math.max(0, p.maxAnimals - animalCount));
    for (const animal of group) {
      let mediaIndex = 0;
      for (const media of (
        animal.media || [{ kind: "photo", src: animal.photo }]
      )
        .filter((m) => m.kind !== "video" || p.includeVideos)
        .slice(0, p.photosPerAnimal + 1))
        add(
          "animal",
          media.kind === "video"
            ? Math.min(p.videoSeconds, media.duration || p.videoSeconds)
            : p.photoSeconds,
          {
            animal,
            media,
            key: `animal:${animal.id}:${media.id || mediaIndex++}`,
          },
        );
      animalCount++;
      insertAt(animalCount);
      if (
        p.statsEnabled &&
        p.statsEvery > 0 &&
        animalCount % p.statsEvery === 0
      )
        add("stats", p.statsSeconds, { key: `stats:${animal.id}` });
      if (p.logoEvery > 0 && animalCount % p.logoEvery === 0)
        add("logo", Math.max(3, p.introSeconds), { key: `logo:${animal.id}` });
    }
  }
  insertAt(animalCount, true);
  if (!scenes.length) add("logo", 5, { key: "empty" });
  return finish();
}
export function moveScene(order, key, target, after = false) {
  if (key === target || !order.includes(key) || !order.includes(target))
    return order;
  const next = order.filter((k) => k !== key);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, key);
  return next;
}
export function sceneAt(timeline, frame) {
  const f = ((frame % timeline.frames) + timeline.frames) % timeline.frames;
  return {
    ...timeline.scenes.find((s) => f >= s.start && f < s.start + s.duration),
    frame: f,
  };
}
export function scheduleOpen(p, at = new Date()) {
  if (!p.scheduleEnabled) return true;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      parts.weekday,
    ),
    time = `${parts.hour}:${parts.minute}`;
  if (p.startTime <= p.endTime)
    return p.days.includes(day) && time >= p.startTime && time < p.endTime;
  return (
    (p.days.includes(day) && time >= p.startTime) ||
    (p.days.includes((day + 6) % 7) && time < p.endTime)
  );
}
