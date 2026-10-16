import { useEffect, useRef, useState, useMemo } from "react";
import { Pause, Play, SkipBack, SkipForward, Maximize } from "lucide-react";
import { SignageCanvas, BrandLogo } from "../shared/SignageCanvas.jsx";
import {
  showSize,
  showTimeline,
  sceneAt,
  scheduleOpen,
} from "../shared/signage.mjs";
export function ShowPlayer({ show, full = false, seekFrame, synced = false }) {
  const wrap = useRef(),
    [scale, setScale] = useState(1),
    [frame, setFrame] = useState(0),
    [paused, setPaused] = useState(false),
    [controls, setControls] = useState(true);
  const clock = useRef({ frame: 0, time: 0 }),
    timeline = useMemo(() => showTimeline(show), [show]),
    size = showSize(show.program.orientation);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const resize = () =>
      setScale(
        Math.min(el.clientWidth / size.width, el.clientHeight / size.height),
      );
    resize();
    const r = new ResizeObserver(resize);
    r.observe(el);
    return () => r.disconnect();
  }, [size.width, size.height]);
  useEffect(() => {
    clock.current = { frame: frame % timeline.frames, time: performance.now() };
  }, [show]);
  useEffect(() => {
    let timer = 0,
      raf = 0,
      last = 0;
    clock.current = { frame: clock.current.frame, time: performance.now() };
    const tick = (now) => {
      if (!paused && now - last >= 1000 / 24) {
        last = now;
        const f =
          (clock.current.frame + ((now - clock.current.time) * 24) / 1000) %
          timeline.frames;
        setFrame(
          Math.floor(
            synced
              ? (((Date.now() - (show.clockOffset || 0)) / 1000) * 24) %
                  timeline.frames
              : f,
          ),
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    if (full) timer = setTimeout(() => setControls(false), 3500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (!paused)
        clock.current.frame =
          (clock.current.frame +
            ((performance.now() - clock.current.time) * 24) / 1000) %
          timeline.frames;
    };
  }, [paused, timeline.frames, full, synced]);
  useEffect(() => {
    if (!seekFrame) return;
    const next = Math.min(timeline.frames - 1, Math.max(0, seekFrame.frame));
    clock.current = { frame: next, time: performance.now() };
    setFrame(next);
    setPaused(true);
  }, [seekFrame]);
  const skip = (direction) => {
    const scene = sceneAt(timeline, frame),
      index = timeline.scenes.findIndex((s) => s.start === scene.start),
      nextScene =
        timeline.scenes[
          (index + direction + timeline.scenes.length) % timeline.scenes.length
        ],
      next =
        nextScene.start +
        (paused ? Math.min(32, Math.floor(nextScene.duration / 2)) : 0);
    clock.current = { frame: next, time: performance.now() };
    setFrame(next);
  };
  useEffect(() => {
    if (!full) return;
    const handler = (e) => {
      if (e.key === "ArrowRight") skip(1);
      if (e.key === "ArrowLeft") skip(-1);
      if (e.key === " ") {
        e.preventDefault();
        setPaused((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [full, frame, paused]);
  const open = scheduleOpen(show.program);
  return (
    <div
      className={`show-player ${full ? "show-full" : ""}`}
      ref={wrap}
      style={
        !full && size.height > size.width
          ? {
              aspectRatio: "9/16",
              maxWidth: 400,
              width: "100%",
              margin: "0 auto",
            }
          : undefined
      }
      onPointerMove={() => setControls(true)}
      onPointerLeave={() => full && setControls(false)}
    >
      {!full || open ? (
        <div
          className="show-stage"
          style={{
            width: size.width,
            height: size.height,
            transform: `translate(-50%,-50%) scale(${scale})`,
          }}
        >
          <SignageCanvas show={show} frame={frame} paused={paused} />
        </div>
      ) : (
        <div className="show-standby">
          <BrandLogo width={140} />
          <h1>{show.refugeName}</h1>
          <p>À bientôt au refuge</p>
        </div>
      )}
      <div
        className={`show-controls ${controls ? "visible" : ""}`}
        onPointerMove={(e) => e.stopPropagation()}
      >
        {full && <a href="#gallery">← Anipic</a>}
        <button aria-label="Séquence précédente" onClick={() => skip(-1)}>
          <SkipBack size={18} />
        </button>
        <button
          aria-label={paused ? "Lire" : "Pause"}
          onClick={() => setPaused((v) => !v)}
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button aria-label="Séquence suivante" onClick={() => skip(1)}>
          <SkipForward size={18} />
        </button>
        <span>
          {Math.floor(frame / 24)} / {Math.round(timeline.frames / 24)} s
        </span>
        {full && (
          <button
            aria-label="Plein écran"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen?.()
                : document.documentElement.requestFullscreen?.().catch(() => {})
            }
          >
            <Maximize size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
