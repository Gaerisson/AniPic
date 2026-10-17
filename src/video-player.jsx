import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  PictureInPicture,
  RotateCcw,
  RotateCw,
} from "lucide-react";
const time = (n) =>
  `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, "0")}`;
export function VideoPlayer({ src, id, title, onError }) {
  const ref = useRef(),
    box = useRef(),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(1),
    [muted, setMuted] = useState(false),
    [rate, setRate] = useState(1),
    [loaded, setLoaded] = useState(false),
    [resume, setResume] = useState(0),
    [error, setError] = useState("");
  const saved = useRef(0);
  const hideTimer = useRef(),
    [controlsVisible, setControlsVisible] = useState(true),
    [full, setFull] = useState(false);
  const reveal = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (full && playing)
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
  };
  useEffect(() => {
    const changed = () => {
      setFull(document.fullscreenElement === box.current);
      setControlsVisible(true);
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      clearTimeout(hideTimer.current);
    };
  }, []);
  useEffect(() => {
    reveal();
    return () => clearTimeout(hideTimer.current);
  }, [full, playing]);
  const seek = (n) => {
    if (ref.current && Number.isFinite(ref.current.duration)) {
      ref.current.currentTime = Math.max(0, Math.min(ref.current.duration, n));
      setPosition(ref.current.currentTime);
    }
  };
  const play = () => {
    const v = ref.current;
    if (v.paused)
      v.play().catch(() =>
        setError("Appuyez sur lecture pour lancer la vidéo."),
      );
    else v.pause();
  };
  const fullscreen = () => {
    const promise = document.fullscreenElement
      ? document.exitFullscreen()
      : box.current?.requestFullscreen?.();
    promise?.catch(() =>
      setError("Plein écran indisponible dans ce navigateur."),
    );
  };
  useEffect(() => {
    saved.current = 0;
    setLoaded(false);
    setPlaying(false);
    setError("");
    setPosition(0);
    setDuration(0);
    setRate(1);
    try {
      setResume(Number(localStorage.getItem("anipic-c8-" + id)) || 0);
    } catch {}
  }, [id]);
  useEffect(() => {
    if (ref.current) {
      ref.current.volume = volume;
      ref.current.muted = muted;
      ref.current.playbackRate = rate;
    }
  }, [volume, muted, rate, id]);
  const remember = () => {
    const v = ref.current;
    if (!v || !Number.isFinite(v.duration)) return;
    setPosition(v.currentTime);
    if (Math.abs(v.currentTime - saved.current) > 5) {
      saved.current = v.currentTime;
      try {
        localStorage.setItem(
          "anipic-c8-" + id,
          String(v.duration - v.currentTime < 10 ? 0 : v.currentTime),
        );
      } catch {}
    }
  };
  return (
    <div
      className={
        "c8-player " +
        (full && !controlsVisible && playing ? "controls-idle" : "")
      }
      ref={box}
      onPointerMove={reveal}
      onFocusCapture={reveal}
      tabIndex={0}
      aria-label={"Lecteur vidéo " + title}
      onKeyDown={(e) => {
        reveal();
        if (e.target.closest("input,select,button")) return;
        const k = e.key.toLowerCase();
        if ([" ", "arrowleft", "arrowright", "f", "m"].includes(k))
          e.preventDefault();
        if (k === " ") play();
        if (k === "arrowleft") seek(position - 10);
        if (k === "arrowright") seek(position + 10);
        if (k === "f") fullscreen();
        if (k === "m") setMuted((m) => !m);
      }}
    >
      <div className="c8-screen">
        <video
          key={id}
          ref={ref}
          src={src}
          playsInline
          preload="metadata"
          onClick={play}
          onDoubleClick={fullscreen}
          onLoadedMetadata={() => {
            const d = ref.current.duration;
            if (Number.isFinite(d)) {
              setDuration(d);
              setLoaded(true);
            }
          }}
          onTimeUpdate={remember}
          onPlay={() => {
            setPlaying(true);
            setError("");
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            try {
              localStorage.removeItem("anipic-c8-" + id);
            } catch {}
          }}
          onError={() => {
            setError(
              "Ce codec ne peut pas être lu ici. Utilisez une version MP4 H.264/AAC ou WebM.",
            );
            onError?.();
          }}
        />
        {!playing && (
          <button
            className="c8-center-play"
            aria-label="Lire la vidéo"
            onClick={play}
          >
            <Play size={36} />
          </button>
        )}
      </div>
      {resume > 10 && resume < duration - 10 && (
        <div className="resume-banner">
          <span>Reprendre à {time(resume)} ?</span>
          <button
            onClick={() => {
              seek(resume);
              setResume(0);
              ref.current.play().catch(() => {});
            }}
          >
            Reprendre
          </button>
          <button onClick={() => setResume(0)}>Depuis le début</button>
        </div>
      )}
      <div className="c8-controls">
        <label className="c8-seek">
          <span className="sr-only">Position dans la vidéo</span>
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            disabled={!loaded}
            value={Math.min(position, duration || 1)}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </label>
        <div className="c8-control-row">
          <button aria-label={playing ? "Pause" : "Lecture"} onClick={play}>
            {playing ? <Pause /> : <Play />}
          </button>
          <button
            aria-label="Reculer de 10 secondes"
            onClick={() => seek(position - 10)}
          >
            <RotateCcw size={18} />
          </button>
          <button
            aria-label="Avancer de 10 secondes"
            onClick={() => seek(position + 10)}
          >
            <RotateCw size={18} />
          </button>
          <span className="c8-time">
            {time(position)} / {time(duration)}
          </span>
          <button
            aria-label={muted ? "Activer le son" : "Couper le son"}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            className="c8-volume"
            aria-label="Volume vidéo"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
          />
          <select
            aria-label="Vitesse de lecture"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
          <button
            aria-label="Image dans l’image"
            disabled={!document.pictureInPictureEnabled}
            onClick={() =>
              ref.current
                .requestPictureInPicture?.()
                .catch(() => setError("Image dans l’image indisponible."))
            }
          >
            <PictureInPicture size={18} />
          </button>
          <button aria-label="Plein écran vidéo" onClick={fullscreen}>
            <Maximize size={18} />
          </button>
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      <p className="c8-shortcuts">
        Espace : lecture · ← → : 10 s · F : plein écran · M : son
      </p>
    </div>
  );
}
