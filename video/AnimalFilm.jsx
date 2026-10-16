import React from "react";
import { BrandLogo } from "../shared/SignageCanvas.jsx";
import { AnnualMosaic } from "./AnnualMosaic.jsx";
import { Subtitles } from "./Subtitles.jsx";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import {
  FPS,
  INTRO,
  OUTRO,
  CROSSFADE,
  introFrames,
  outroFrames,
} from "./timing.mjs";
const ease = (f, a, b) =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
const amber = "#f4ab70",
  paper = "#f7f1e9";
function Scene({ clip, index, film, last }) {
  const frame = useCurrentFrame(),
    { width: w, height: h, fps } = useVideoConfig();
  const portrait = h > w,
    unit = Math.min(w, h) / 720,
    duration = Math.round(clip.seconds * fps),
    still = film.motion === "off";
  const reveal = ease(frame, 0, CROSSFADE),
    exit = last ? 1 - ease(frame, duration - 12, duration) : 1;
  const lively = film.motion === "lively",
    enter = still
      ? 1
      : spring({
          frame: Math.max(0, frame - 5),
          fps,
          config: { damping: lively ? 14 : 26, stiffness: 100 },
        });
  const label = still ? 1 : ease(frame, 12, 26),
    zoom = still
      ? 1
      : interpolate(frame, [0, duration], [1.015, lively ? 1.1 : 1.045], {
          extrapolateRight: "clamp",
        });
  const editorial = film.look === "editorial";
  const amber = film.accentColor || "#f4ab70";
  const mediaStyle = editorial
    ? portrait
      ? { left: 0, top: 0, width: w, height: h * 0.6 }
      : { left: 0, top: 0, width: w * 0.62, height: h }
    : { inset: 0 };
  const facts = film.showFacts !== false;
  const incoming =
    film.transition === "slide" && index > 0
      ? `translateX(${(1 - reveal) * w}px)`
      : "none";
  const wipe =
    film.transition === "wipe" && index > 0
      ? `inset(0 ${(1 - reveal) * 100}% 0 0)`
      : undefined;
  const opacity =
    (film.transition === "fade" || index === 0 ? reveal : 1) * exit;
  return (
    <AbsoluteFill
      style={{
        background: "#191a1c",
        color: paper,
        fontFamily: "Arial,sans-serif",
        opacity,
        transform: incoming,
        clipPath: wipe,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          ...mediaStyle,
          overflow: "hidden",
          background: "#101113",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: clip.fit === "contain" ? "none" : `scale(${zoom})`,
          }}
        >
          {clip.kind === "video" ? (
            <OffthreadVideo
              src={clip.src}
              trimBefore={Math.round((clip.trim || 0) * fps)}
              muted={clip.muted !== false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: clip.fit || "cover",
                objectPosition: `${clip.focusX ?? 50}% ${clip.focusY ?? 50}%`,
              }}
            />
          ) : (
            <Img
              src={clip.src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: clip.fit || "cover",
                objectPosition: `${clip.focusX ?? 50}% ${clip.focusY ?? 50}%`,
              }}
            />
          )}
        </div>
        {!editorial && (
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg,#0003 10%,transparent 25%,#0d1012f5 100%)",
            }}
          />
        )}
      </div>
      {editorial && (
        <div
          style={{
            position: "absolute",
            left: portrait ? 0 : w * 0.62,
            top: portrait ? h * 0.6 : 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse at 90% 100%,#724b282f,transparent 70%),#191a1c",
            borderLeft: portrait ? "none" : "1px solid #f4ab702b",
            borderTop: portrait ? "1px solid #f4ab702b" : "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 24 * unit,
          left: 28 * unit,
          display: "flex",
          alignItems: "center",
          gap: 12 * unit,
          fontSize: 12 * unit,
          letterSpacing: 3 * unit,
          color: amber,
        }}
      >
        <span
          style={{
            width: 7 * unit,
            height: 7 * unit,
            borderRadius: "50%",
            background: amber,
          }}
        />
        {film.template === "year"
          ? `${film.year || ""} · LES HISTOIRES DU REFUGE`
          : film.brandLabel}
      </div>
      {film.showLogo !== false && (
        <div
          style={{
            position: "absolute",
            top: 22 * unit,
            right: 25 * unit,
            opacity: label,
          }}
        >
          <BrandLogo src={staticFile("spa-logo.png")} width={64 * unit} />
        </div>
      )}
      {film.showQr !== false && clip.qr && (
        <div
          style={{
            position: "absolute",
            right: 28 * unit,
            bottom: 28 * unit,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5 * unit,
            zIndex: 2,
          }}
        >
          <Img
            src={clip.qr}
            style={{
              width: 88 * unit,
              height: 88 * unit,
              borderRadius: 5 * unit,
            }}
          />
          <span
            style={{
              fontSize: 9 * unit,
              color: "#fff",
              textShadow: "0 1px 5px #000",
            }}
          >
            {clip.qrLabel}
          </span>
        </div>
      )}
      {clip.sos && (
        <div
          style={{
            position: "absolute",
            top: 92 * unit,
            left: 28 * unit,
            background: "#ee8736",
            color: "#261508",
            fontSize: 14 * unit,
            fontWeight: 700,
            padding: `${8 * unit}px ${12 * unit}px`,
            borderRadius: 6 * unit,
          }}
        >
          SOS ADOPTION
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: editorial
            ? portrait
              ? 32 * unit
              : w * 0.62 + 32 * unit
            : 40 * unit,
          right: 32 * unit,
          top: editorial
            ? portrait
              ? h * 0.6 + 32 * unit
              : h * 0.25
            : undefined,
          bottom: editorial
            ? undefined
            : (film.subtitles?.enabled && film.subtitles.position !== "middle"
                ? 195
                : 85) * unit,
          padding: film.look === "minimal" ? 24 * unit : 0,
          background: film.look === "minimal" ? "#11151bde" : undefined,
          borderRadius: film.look === "minimal" ? 18 * unit : undefined,
          transform: `translateY(${(1 - enter) * 30 * unit}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10 * unit,
            color: amber,
            fontSize: 12 * unit,
            letterSpacing: 2 * unit,
            marginBottom: 18 * unit,
            opacity: label,
          }}
        >
          <span
            style={{
              width: 28 * unit,
              height: 2 * unit,
              background: amber,
              transform: `scaleX(${label})`,
              transformOrigin: "left",
            }}
          />
          {film.template === "year"
            ? `PORTRAIT ${String(index + 1).padStart(2, "0")}`
            : clip.subtitle || "À LA RENCONTRE DE"}
        </div>
        <div
          style={{
            fontSize: (portrait ? 56 : editorial ? 52 : 68) * unit,
            fontWeight: 700,
            letterSpacing: -2 * unit,
            lineHeight: 1.05,
            overflowWrap: "anywhere",
            marginBottom: 18 * unit,
          }}
        >
          {clip.title}
        </div>
        {facts && clip.facts && (
          <div
            style={{
              fontSize: 18 * unit,
              lineHeight: 1.5,
              color: "#c9c5bf",
              marginBottom: 18 * unit,
              opacity: label,
            }}
          >
            {clip.facts}
          </div>
        )}
        {clip.caption && (
          <div
            style={{
              fontSize: 17 * unit,
              lineHeight: 1.55,
              color: paper,
              whiteSpace: "pre-wrap",
              maxWidth: editorial ? "100%" : "80%",
              opacity: label,
            }}
          >
            {clip.caption}
          </div>
        )}
        {facts && clip.ententes && (
          <div
            style={{
              fontSize: 14 * unit,
              lineHeight: 1.7,
              color: amber,
              marginTop: 22 * unit,
              opacity: label,
            }}
          >
            {clip.ententes}
          </div>
        )}
      </div>
      {film.ctaText && (
        <div
          style={{
            position: "absolute",
            bottom: 40 * unit,
            left: 28 * unit,
            right: 28 * unit,
            fontSize: 14 * unit,
            color: amber,
          }}
        >
          {film.ctaText}
        </div>
      )}
      {film.showProgress !== false && (
        <div
          style={{
            position: "absolute",
            bottom: 18 * unit,
            left: 28 * unit,
            right: 28 * unit,
            height: 2 * unit,
            background: "#ffffff13",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (frame / duration) * 100)}%`,
              background: amber,
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}
function Title({ film, end = false }) {
  const frame = useCurrentFrame(),
    { width: w, height: h, fps } = useVideoConfig(),
    u = Math.min(w, h) / 720;
  const amber = film.accentColor || "#f4ab70";
  const animate = film.motion !== "off",
    progress = animate
      ? spring({ frame, fps, config: { damping: 24, stiffness: 80 } })
      : 1;
  const words = (
    end ? film.outro || "Chaque regard compte." : film.title
  ).split(" ");
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 80% 20%,#5a352d4d,transparent 55%),#141517",
        color: paper,
        fontFamily: "Arial,sans-serif",
        justifyContent: "center",
        padding: 60 * u,
        overflow: "hidden",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            right: -w * 0.2,
            bottom: -w * 0.35,
            width: w * (0.6 + i * 0.18),
            height: w * (0.6 + i * 0.18),
            borderRadius: "50%",
            border: "1px solid #f4ab7025",
            transform: animate
              ? `translate(${Math.sin(frame / 70 + i) * 14}px,${Math.cos(frame / 80 + i) * 14}px)`
              : "none",
          }}
        />
      ))}
      <div
        style={{
          fontSize: 13 * u,
          color: amber,
          letterSpacing: 5 * u,
          marginBottom: 32 * u,
          display: "flex",
          alignItems: "center",
          gap: 12 * u,
        }}
      >
        <span
          style={{
            width: 36 * u,
            height: 2 * u,
            background: amber,
            transform: `scaleX(${progress})`,
            transformOrigin: "left",
          }}
        />
        {film.brandLabel || "Refuge de Morée"}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: `${10 * u}px ${16 * u}px`,
          maxWidth: w * 0.8,
          fontSize: Math.min(w * 0.072, 72 * u),
          fontWeight: 700,
          letterSpacing: -2 * u,
          lineHeight: 1.12,
        }}
      >
        {words.map((word, i) => {
          const p = animate ? ease(frame, i * 2, 16 + i * 2) : 1;
          return (
            <span
              key={i}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 35 * u}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontSize: 20 * u,
          lineHeight: 1.5,
          color: "#c8c1b8",
          marginTop: 28 * u,
          opacity: progress,
          transform: `translateY(${(1 - progress) * 20 * u}px)`,
        }}
      >
        {end ? film.outroSubtitle || film.ctaText : film.subtitle}
      </div>
      {film.showLogo !== false && (
        <div
          style={{
            position: "absolute",
            top: 30 * u,
            right: 32 * u,
            opacity: progress,
          }}
        >
          <BrandLogo src={staticFile("spa-logo.png")} width={70 * u} />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 60 * u,
          bottom: 40 * u,
          color: amber,
          fontSize: 12 * u,
          letterSpacing: 2 * u,
        }}
      >
        {film.ctaText}
      </div>
    </AbsoluteFill>
  );
}
export function AnimalFilm({ film }) {
  const intro = introFrames(film),
    outro = outroFrames(film);
  let start = intro;
  const scenes = film.clips.map((clip, index) => {
    const from = start,
      duration = Math.round(clip.seconds * FPS);
    start += duration - (index < film.clips.length - 1 ? CROSSFADE : 0);
    return (
      <Sequence key={clip.id || index} from={from} durationInFrames={duration}>
        <Scene
          clip={clip}
          index={index}
          film={film}
          last={index === film.clips.length - 1}
        />
      </Sequence>
    );
  });
  return (
    <AbsoluteFill style={{ background: "#141517" }}>
      {film.template === "year" && film.annualStyle === "mosaic" ? (
        <AnnualMosaic film={film} />
      ) : (
        <>
          {intro > 0 && (
            <Sequence durationInFrames={intro}>
              <Title film={film} />
            </Sequence>
          )}
          {scenes}
          {outro > 0 && (
            <Sequence from={start} durationInFrames={outro}>
              <Title film={film} end />
            </Sequence>
          )}
        </>
      )}
      <Subtitles config={film.subtitles} />
      {film.music?.src && (
        <Audio
          src={film.music.src}
          loop
          volume={(f) =>
            Math.min(
              ease(f, 0, FPS),
              1 - ease(f, Math.max(0, start + outro - FPS), start + outro),
            ) *
            film.music.volume *
            (film.voiceover &&
            f >= film.voiceover.start * FPS &&
            f < (film.voiceover.start + film.voiceover.duration) * FPS
              ? 0.45
              : 1)
          }
        />
      )}
      {film.voiceover?.src && (
        <Sequence from={Math.round(film.voiceover.start * FPS)}>
          <Audio src={film.voiceover.src} volume={film.voiceover.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
