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
export function narrationFrames(film) {
  const voice = film.voiceover;
  return film.narrationMode !== "manual" &&
    Number.isFinite(voice?.duration) &&
    voice.duration > 0
    ? Math.ceil(((voice.start || 0) + voice.duration) * FPS)
    : 0;
}
export const introFrames = (film) =>
  Math.min(
    Math.round((film.introSeconds ?? 2) * FPS),
    narrationFrames(film) ? Math.floor(narrationFrames(film) * 0.18) : Infinity,
  );
export const outroFrames = (film) =>
  Math.min(
    Math.round((film.outroSeconds ?? 2) * FPS),
    narrationFrames(film) ? Math.floor(narrationFrames(film) * 0.18) : Infinity,
  );
export function filmDuration(film) {
  if (narrationFrames(film)) return narrationFrames(film);
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

// The editor and renderer share this frame-exact schedule. Source clips stay intact:
// long narrations revisit the media, while video excerpts are never slowed or stretched.
export function filmTimeline(film) {
  const duration = filmDuration(film),
    intro = introFrames(film),
    outro = outroFrames(film);
  const auto = !!narrationFrames(film);
  if (!film.clips.length)
    return {
      duration,
      intro,
      outro,
      scenes: [],
      auto,
      repeated: 0,
      omitted: 0,
    };
  if (film.template === "year" && film.annualStyle === "mosaic") {
    const finish = Math.max(1, Math.floor(duration * 0.68));
    return {
      duration,
      intro: 0,
      outro: duration - finish,
      auto,
      repeated: 0,
      omitted: 0,
      scenes: film.clips.map((clip, sourceIndex) => {
        const from = Math.floor((sourceIndex * finish) / film.clips.length),
          frames = Math.max(
            1,
            Math.floor(((sourceIndex + 1) * finish) / film.clips.length) - from,
          );
        return {
          from,
          duration: frames,
          overlap: 0,
          sourceIndex,
          repeat: false,
          clip: { ...clip, seconds: frames / FPS },
        };
      }),
    };
  }
  let indices = film.clips.map((_, i) => i);
  let lengths = film.clips.map((clip) => Math.round(clip.seconds * FPS));
  let overlap = CROSSFADE;
  if (auto) {
    const content = Math.max(1, duration - intro - outro);
    const capacity = (index) =>
      film.clips[index].kind === "video"
        ? Math.round(film.clips[index].seconds * FPS)
        : 6 * FPS;
    overlap = Math.min(CROSSFADE, Math.max(0, Math.floor(content / 4)));
    const minimum = (index) => Math.min(capacity(index), FPS, content);
    // A very short voice cannot show every source with a readable duration.
    while (
      indices.length > 1 &&
      indices.reduce((sum, i) => sum + minimum(i), 0) -
        (indices.length - 1) * overlap >
        content
    )
      indices.pop();
    let covered =
      indices.reduce((sum, i) => sum + capacity(i), 0) -
      (indices.length - 1) * overlap;
    let next = 0;
    while (covered < content) {
      const index = next++ % film.clips.length;
      indices.push(index);
      covered += capacity(index) - overlap;
    }
    lengths = indices.map(minimum);
    let remaining =
      content +
      (indices.length - 1) * overlap -
      lengths.reduce((sum, n) => sum + n, 0);
    // Repeating a short video can overshoot by less than one overlap.
    // Trim the final occurrence rather than extending the film past the voice.
    for (let i = lengths.length - 1; remaining < 0 && i >= 0; i--) {
      const cut = Math.min(
        -remaining,
        lengths[i] - Math.min(content, overlap + 1),
      );
      lengths[i] -= cut;
      remaining += cut;
    }
    while (remaining > 0) {
      const available = indices
        .map((index, i) => ({ index, i }))
        .filter(({ index, i }) => lengths[i] < capacity(index));
      if (!available.length) break;
      const weight = available.reduce(
        (sum, { index }) => sum + film.clips[index].seconds,
        0,
      );
      const budget = remaining;
      for (const { index, i } of available) {
        const extra = Math.min(
          remaining,
          capacity(index) - lengths[i],
          Math.max(
            1,
            Math.floor((budget * film.clips[index].seconds) / weight),
          ),
        );
        lengths[i] += extra;
        remaining -= extra;
      }
    }
  }
  let start = intro;
  const seen = new Set();
  const scenes = indices.map((sourceIndex, index) => {
    const from = start,
      frames = lengths[index],
      repeat = seen.has(sourceIndex);
    seen.add(sourceIndex);
    start += frames - (index < indices.length - 1 ? overlap : 0);
    return {
      from,
      duration: frames,
      overlap,
      sourceIndex,
      repeat,
      clip: { ...film.clips[sourceIndex], seconds: frames / FPS },
    };
  });
  return {
    duration,
    intro,
    outro,
    scenes,
    auto,
    repeated: indices.length - seen.size,
    omitted: film.clips.length - seen.size,
  };
}

export function moveFilmClip(clips, from, to) {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= clips.length ||
    to >= clips.length
  )
    return clips;
  const next = [...clips],
    [clip] = next.splice(from, 1);
  next.splice(to, 0, clip);
  return next;
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
