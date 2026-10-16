export const FPS = 24;
export const INTRO = 2 * FPS;
export const OUTRO = 2 * FPS;
export const CROSSFADE = 12;
export function dimensions(aspect = "landscape", resolution = "720") {
  const short = Number(resolution) === 1080 ? 1080 : 720;
  const long = Math.round((short * 16) / 9);
  return aspect === "portrait"
    ? { width: short, height: long }
    : aspect === "square"
      ? { width: short, height: short }
      : { width: long, height: short };
}
export const introFrames = (film) => Math.round((film.introSeconds ?? 2) * FPS);
export const outroFrames = (film) => Math.round((film.outroSeconds ?? 2) * FPS);
export function filmDuration(film) {
  return (
    introFrames(film) +
    outroFrames(film) -
    Math.max(0, film.clips.length - 1) * CROSSFADE +
    film.clips.reduce(
      (total, clip) => total + Math.round(clip.seconds * FPS),
      0,
    )
  );
}

// Extend stills only, without trimming clips or exceeding the editor's limits.
export function extendForNarration(film, audioSeconds) {
  if (!film.voiceover || !Number.isFinite(audioSeconds) || audioSeconds <= 0)
    return film;
  const target = Math.min(
    600 * FPS,
    Math.ceil((film.voiceover.start + audioSeconds + 0.25) * FPS),
  );
  let missing = target - filmDuration(film);
  if (missing <= 0) return film;
  const clips = film.clips.map((clip) => ({ ...clip }));
  while (missing > 0) {
    const available = clips.filter(
      (clip) =>
        clip.kind === "photo" && Math.round(clip.seconds * FPS) < 12 * FPS,
    );
    if (!available.length) break;
    const share = Math.ceil(missing / available.length);
    for (const clip of available) {
      const frames = Math.round(clip.seconds * FPS);
      const extra = Math.min(share, 12 * FPS - frames, missing);
      clip.seconds = (frames + extra) / FPS;
      missing -= extra;
    }
  }
  return { ...film, clips };
}
