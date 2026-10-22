import { useImageReadiness, AssetLoading } from "./asset-readiness.jsx";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Pause, Play, SkipBack, SkipForward, Maximize } from "lucide-react";
import { SignageCanvas, BrandLogo } from "../shared/SignageCanvas.jsx";
import {
  showSize,
  showTimeline,
  sceneAt,
  scheduleOpen,
} from "../shared/signage.mjs";
export function ShowPlayer(props) {
  const state = useImageReadiness(
    (props.show.items || [])
      .flatMap((a) =>
        (a.media || []).filter((m) => m.kind === "photo").map((m) => m.src),
      )
      .concat("/spa-logo.png"),
  );
  const [loaded, setLoaded] = useState(null);
  const report = useCallback(
    (status) =>
      props.onStatus?.({
        ...status,
        issues: [
          ...new Set([
            ...(status.issues || []),
            ...(!state.ready && state.failed.length ? ["image_load"] : []),
          ]),
        ],
      }),
    [props.onStatus, state.ready, state.failed.length],
  );
  useEffect(() => {
    if (!state.ready && !loaded)
      props.onStatus?.({
        state: state.failed.length ? "error" : "loading",
        revision: "",
        scene: null,
        issues: state.failed.length ? ["image_load"] : [],
        cursor: null,
      });
  }, [state.ready, state.failed.length, state.done, loaded, props.onStatus]);
  useEffect(() => {
    if (state.ready) setLoaded(props.show);
  }, [state.ready, props.show]);
  if (!state.ready && !loaded) return <AssetLoading state={state} />;
  return (
    <>
      <ReadyShowPlayer
        {...props}
        onStatus={props.onStatus ? report : undefined}
        show={state.ready ? props.show : loaded}
      />
      {!state.ready && !props.full && (
        <div className="show-refresh-status" role="status">
          Préparation de la nouvelle sélection · {state.done}/{state.total}
          {state.failed.length > 0 && (
            <button onClick={state.retry}>Réessayer</button>
          )}
        </div>
      )}
    </>
  );
}
function ReadyShowPlayer({
  show,
  full = false,
  seekFrame,
  synced = false,
  onStatus,
  monitorControl,
}) {
  const wrap = useRef(),
    [scale, setScale] = useState(1),
    [frame, setFrame] = useState(0),
    [paused, setPaused] = useState(false),
    [controls, setControls] = useState(true),
    [mediaIssue, setMediaIssue] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)"),
      changed = () => setReduceMotion(query.matches);
    if (query.addEventListener) query.addEventListener("change", changed);
    else query.addListener?.(changed);
    return () => {
      if (query.removeEventListener)
        query.removeEventListener("change", changed);
      else query.removeListener?.(changed);
    };
  }, []);
  const waiting = useRef(null),
    lastReport = useRef({ at: 0, key: "", state: "", issue: null });
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
      if (!paused && now - last >= 1000 / 60 - 1) {
        last = now;
        const f =
          (clock.current.frame + ((now - clock.current.time) * 24) / 1000) %
          timeline.frames;
        setFrame(
          synced
            ? (((Date.now() - (show.clockOffset || 0)) / 1000) * 24) %
                timeline.frames
            : f,
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
  const currentScene = sceneAt(timeline, frame);
  const mediaStatus = useCallback((code) => {
    if (code === "video_stalled") {
      if (!waiting.current)
        waiting.current = setTimeout(() => {
          waiting.current = null;
          setMediaIssue("video_stalled");
        }, 5000);
      return;
    }
    clearTimeout(waiting.current);
    waiting.current = null;
    setMediaIssue(code);
  }, []);
  useEffect(() => {
    mediaStatus(null);
    return () => {
      clearTimeout(waiting.current);
      waiting.current = null;
    };
  }, [currentScene.key, mediaStatus]);
  useEffect(() => {
    if (!onStatus) return;
    const state = full && !open ? "standby" : paused ? "paused" : "playing",
      time = performance.now(),
      key = currentScene.key;
    if (
      time - lastReport.current.at < 1000 &&
      key === lastReport.current.key &&
      state === lastReport.current.state &&
      mediaIssue === lastReport.current.issue
    )
      return;
    lastReport.current = { at: time, key, state, issue: mediaIssue };
    onStatus({
      state,
      revision: show.revision || "",
      cursor: Math.floor(frame),
      issues: mediaIssue ? [mediaIssue] : [],
      scene:
        state === "standby"
          ? null
          : {
              key,
              title: String(
                currentScene.animal?.name ||
                  currentScene.block?.title ||
                  {
                    logo: "Logo SPA",
                    stats: "Les chiffres du refuge",
                    message: "Message",
                    hours: "Horaires",
                    spa: "Informations SPA",
                    wallpaper: "Fond animé",
                  }[currentScene.type] ||
                  "Séquence",
              ).slice(0, 120),
              type: currentScene.type,
              position: Math.max(
                0,
                Math.floor((currentScene.frame - currentScene.start) / 24),
              ),
              duration: Math.round(currentScene.duration / 24),
            },
    });
  }, [
    frame,
    paused,
    open,
    full,
    mediaIssue,
    show.revision,
    currentScene,
    timeline.frames,
    onStatus,
  ]);
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
      onErrorCapture={(e) => {
        if (e.target.tagName === "IMG") mediaStatus("image_load");
      }}
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
          <SignageCanvas
            show={
              reduceMotion
                ? { ...show, program: { ...show.program, motion: "off" } }
                : show
            }
            frame={frame}
            paused={paused}
            onPlaybackIssue={onStatus ? mediaStatus : undefined}
          />
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
        {full && monitorControl}
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
