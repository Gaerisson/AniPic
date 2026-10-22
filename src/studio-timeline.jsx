import { useEffect, useRef, useState } from "react";
import {
  Film,
  Mic,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Scan,
  Repeat2,
  GripVertical,
  Link2,
} from "lucide-react";
import { filmTimeline, FPS } from "../video/timing.mjs";
import { imageUrl } from "./api.js";

export const filmTime = (frames) => {
  const seconds = Math.round((Math.max(0, frames) / FPS) * 10) / 10;
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
};
export const clipThumbnail = (clip) =>
  clip.kind === "video"
    ? null
    : clip.kind === "spa"
      ? `/api/animals/${clip.ref}/source-photo?w=320`
      : imageUrl(clip.ref, 320);

export function StudioTimeline({
  film,
  player,
  selected,
  onSelect,
  onMove,
  onAudio,
  canEdit,
}) {
  const timeline = filmTimeline(film),
    { duration, intro, outro, scenes, auto } = timeline;
  const [frame, setFrame] = useState(0),
    [playing, setPlaying] = useState(false),
    [zoom, setZoom] = useState(0),
    [width, setWidth] = useState(700),
    [drop, setDrop] = useState(null);
  const viewport = useRef(null),
    dragging = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!player) return;
    const update = (event) => setFrame(event.detail.frame);
    const play = () => setPlaying(true),
      pause = () => setPlaying(false);
    player.addEventListener("frameupdate", update);
    player.addEventListener("play", play);
    player.addEventListener("pause", pause);
    player.addEventListener("ended", pause);
    setFrame(player.getCurrentFrame());
    setPlaying(player.isPlaying());
    return () => {
      player.removeEventListener("frameupdate", update);
      player.removeEventListener("play", play);
      player.removeEventListener("pause", pause);
      player.removeEventListener("ended", pause);
    };
  }, [player]);
  const seconds = Math.max(1, duration / FPS),
    scale = zoom ? 36 * zoom : Math.max(80, width - 80) / seconds;
  const trackWidth = Math.max(width - 80, seconds * scale),
    current = Math.min(frame, Math.max(0, duration - 1));
  const tick =
    scale >= 50 ? 1 : scale >= 20 ? 2 : scale >= 8 ? 5 : scale >= 3 ? 10 : 30;
  const seek = (value) => {
    const next = Math.max(0, Math.min(duration - 1, Math.round(value)));
    player?.seekTo(next);
    setFrame(next);
  };
  const scrub = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    seek(((event.clientX - box.left) / scale) * FPS);
  };
  const jump = (direction) => {
    const marks = [
      0,
      ...scenes.map((scene) => scene.from),
      duration - outro,
      duration - 1,
    ];
    seek(
      direction < 0
        ? ([...marks].reverse().find((n) => n < current - 2) ?? 0)
        : (marks.find((n) => n > current + 2) ?? duration - 1),
    );
  };
  return (
    <section className="cut-timeline panel" aria-label="Timeline du film">
      <div className="cut-heading">
        <div>
          <span className="eyebrow">LE MONTAGE</span>
          <h2>Votre histoire, plan par plan</h2>
        </div>
        <span className={auto ? "cut-sync" : "cut-duration"}>
          {auto && <Link2 size={14} />}
          {auto ? "Calée sur la voix" : `${film.clips.length} plans`} ·{" "}
          {filmTime(duration)}
        </span>
      </div>
      <div className="cut-toolbar">
        <div className="cut-transport">
          <button
            aria-label="Plan précédent"
            disabled={!player}
            onClick={() => jump(-1)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="cut-play"
            aria-label={playing ? "Mettre le film en pause" : "Lire le film"}
            disabled={!player}
            onClick={() => player?.toggle()}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            aria-label="Plan suivant"
            disabled={!player}
            onClick={() => jump(1)}
          >
            <SkipForward size={17} />
          </button>
          <output aria-label="Temps de lecture">
            {filmTime(current)} <span>/ {filmTime(duration)}</span>
          </output>
        </div>
        <div className="cut-zoom">
          <button
            aria-label="Réduire le zoom de la timeline"
            onClick={() => setZoom((n) => Math.max(0.5, (n || 1) - 0.5))}
          >
            <ZoomOut size={16} />
          </button>
          <button
            aria-label="Augmenter le zoom de la timeline"
            onClick={() => setZoom((n) => Math.min(5, (n || 1) + 0.5))}
          >
            <ZoomIn size={16} />
          </button>
          <button
            aria-label="Afficher toute la timeline"
            aria-pressed={!zoom}
            onClick={() => setZoom(0)}
          >
            <Scan size={16} />
            <span>Tout voir</span>
          </button>
        </div>
      </div>
      <label className="cut-scrubber">
        <span className="sr-only">Position de lecture</span>
        <input
          type="range"
          min="0"
          max={Math.max(0, duration - 1)}
          step="1"
          value={current}
          disabled={!player}
          aria-valuetext={filmTime(current)}
          onChange={(e) => seek(+e.target.value)}
        />
      </label>
      <div className="cut-scroll" ref={viewport}>
        <div className="cut-tracks" style={{ width: trackWidth + 80 }}>
          <div className="cut-row cut-ruler-row">
            <span className="cut-track-label">TEMPS</span>
            <div
              className="cut-ruler"
              style={{ width: trackWidth }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) scrub(e);
              }}
            >
              {Array.from({ length: Math.ceil(seconds / tick) }, (_, i) => (
                <span key={i} style={{ left: i * tick * scale }}>
                  {filmTime(i * tick * FPS).slice(0, 5)}
                </span>
              ))}
            </div>
          </div>
          <div className="cut-row">
            <span className="cut-track-label">
              <Film size={16} />
              Images
            </span>
            <div className="cut-image-track" style={{ width: trackWidth }}>
              {intro > 0 && (
                <button
                  className="cut-title-clip"
                  style={{ left: 0, width: (intro / FPS) * scale }}
                  onClick={() => seek(0)}
                  title="Introduction"
                >
                  <span>Intro</span>
                </button>
              )}
              {scenes.map((scene, i) => {
                const clip = film.clips[scene.sourceIndex],
                  thumbnail = clipThumbnail(clip),
                  active = selected === (clip.id || scene.sourceIndex);
                return (
                  <button
                    key={i}
                    className={`cut-shot${active ? " selected" : ""}${drop === scene.sourceIndex ? " drop-target" : ""}`}
                    style={{
                      left: (scene.from / FPS) * scale,
                      width: (scene.duration / FPS) * scale,
                    }}
                    aria-label={`Plan ${scene.sourceIndex + 1}${scene.repeat ? ", reprise" : ""} : ${clip.title || (clip.kind === "video" ? "Vidéo" : "Photo")}, ${filmTime(scene.duration)}`}
                    aria-pressed={active}
                    title={`${clip.title || "Plan " + (scene.sourceIndex + 1)} · ${filmTime(scene.duration)}${scene.repeat ? " · reprise automatique" : ""}`}
                    draggable={canEdit && !scene.repeat}
                    onClick={() => {
                      onSelect(scene.sourceIndex);
                      seek(
                        scene.from +
                          Math.min(scene.overlap, scene.duration - 1),
                      );
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.altKey &&
                        ["ArrowLeft", "ArrowRight"].includes(e.key)
                      ) {
                        e.preventDefault();
                        onMove(
                          scene.sourceIndex,
                          scene.sourceIndex + (e.key === "ArrowLeft" ? -1 : 1),
                        );
                      }
                    }}
                    onDragStart={(e) => {
                      dragging.current = scene.sourceIndex;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData(
                        "text/plain",
                        String(scene.sourceIndex),
                      );
                    }}
                    onDragOver={(e) => {
                      if (dragging.current !== null) {
                        e.preventDefault();
                        setDrop(scene.sourceIndex);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging.current !== null)
                        onMove(dragging.current, scene.sourceIndex);
                      dragging.current = null;
                      setDrop(null);
                    }}
                    onDragEnd={() => {
                      dragging.current = null;
                      setDrop(null);
                    }}
                  >
                    {thumbnail && (
                      <img
                        src={thumbnail}
                        alt=""
                        draggable="false"
                        loading="lazy"
                      />
                    )}
                    <span className="cut-shot-number">
                      {String(scene.sourceIndex + 1).padStart(2, "0")}
                      {scene.repeat ? (
                        <Repeat2 size={12} />
                      ) : (
                        <GripVertical size={12} />
                      )}
                    </span>
                    <span className="cut-shot-caption">
                      <strong>
                        {clip.title ||
                          (clip.kind === "video" ? "Vidéo" : "Photo")}
                      </strong>
                      <small>{(scene.duration / FPS).toFixed(1)} s</small>
                    </span>
                  </button>
                );
              })}
              {outro > 0 && (
                <button
                  className="cut-title-clip"
                  style={{
                    left: ((duration - outro) / FPS) * scale,
                    width: (outro / FPS) * scale,
                  }}
                  onClick={() => seek(duration - outro)}
                  title="Conclusion"
                >
                  <span>Fin</span>
                </button>
              )}
              {!scenes.length && (
                <p className="cut-empty">
                  Ajoutez des photos depuis la médiathèque ci-dessous.
                </p>
              )}
            </div>
          </div>
          <div className="cut-row">
            <span className="cut-track-label">
              <Mic size={16} />
              Voix
            </span>
            <div className="cut-audio-track" style={{ width: trackWidth }}>
              {film.voiceover ? (
                <button
                  className="cut-audio-clip voice"
                  onClick={onAudio}
                  style={{
                    left: film.voiceover.start * scale,
                    width: Math.max(2, (film.voiceover.duration || 0) * scale),
                  }}
                  title="Configurer la voix off"
                >
                  <Mic size={14} />
                  <span>
                    Voix off · {filmTime((film.voiceover.duration || 0) * FPS)}
                  </span>
                </button>
              ) : (
                <button className="cut-add-audio" onClick={onAudio}>
                  + Ajouter une voix off
                </button>
              )}
            </div>
          </div>
          <div className="cut-row">
            <span className="cut-track-label">
              <Music size={16} />
              Musique
            </span>
            <div className="cut-audio-track" style={{ width: trackWidth }}>
              {film.music ? (
                <button
                  className="cut-audio-clip music"
                  onClick={onAudio}
                  style={{ left: 0, width: trackWidth }}
                >
                  <Repeat2 size={14} />
                  <span>Musique · fondus et volume adapté à la voix</span>
                </button>
              ) : (
                <button className="cut-add-audio" onClick={onAudio}>
                  + Choisir une musique
                </button>
              )}
            </div>
          </div>
          {film.subtitles?.enabled && (
            <div className="cut-row">
              <span className="cut-track-label">Sous-titres</span>
              <div className="cut-caption-track" style={{ width: trackWidth }}>
                {film.subtitles.cues.map((cue, i) => (
                  <span
                    key={i}
                    style={{
                      left: cue.start * scale,
                      width: (cue.end - cue.start) * scale,
                    }}
                    title={cue.text}
                  >
                    {cue.text}
                  </span>
                ))}
              </div>
            </div>
          )}
          {scenes.length > 0 && (
            <div
              className="cut-playhead"
              aria-hidden="true"
              style={{ left: 80 + (current / FPS) * scale }}
            >
              <span />
            </div>
          )}
        </div>
      </div>
      <div className="cut-footnote">
        <span>Cliquez pour choisir un plan. Glissez pour changer l’ordre.</span>
        <span>Clavier : Alt + ← / →</span>
      </div>
      {auto && (timeline.repeated > 0 || timeline.omitted > 0) && (
        <p className="cut-timing-note" role="status">
          {timeline.repeated > 0 &&
            `${timeline.repeated} reprise${timeline.repeated > 1 ? "s" : ""} automatique${timeline.repeated > 1 ? "s" : ""} pour accompagner toute la voix. Ajoutez des photos pour varier les images. `}
          {timeline.omitted > 0 &&
            `${timeline.omitted} plan${timeline.omitted > 1 ? "s" : ""} hors montage : la voix est trop courte. Allongez la narration ou passez en durée libre.`}
        </p>
      )}
      {film.template === "year" && film.annualStyle === "mosaic" && (
        <p className="cut-timing-note">
          En mosaïque, les photos et la conclusion sont réparties
          automatiquement dans la durée du film.
        </p>
      )}
    </section>
  );
}
