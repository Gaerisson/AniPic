import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhotoConstellation } from "../shared/PhotoConstellation.jsx";
import { filmDuration, FPS } from "./timing.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
export function AnnualMosaic({ film }) {
  const frame = useCurrentFrame(),
    { width: w, height: h } = useVideoConfig(),
    u = Math.min(w, h) / 1080,
    portrait = h > w;
  const entries = film.clips.filter((c) => c.kind === "photo"),
    total = filmDuration(film),
    finishStart = Math.max(1, Math.floor(total * 0.63)),
    finishFrames = total - finishStart;
  const step = finishStart / Math.max(1, entries.length),
    index = Math.min(entries.length - 1, Math.floor(frame / step)),
    local = (frame - index * step) / FPS,
    entrance = ease(local / 0.6);
  const current = entries[index],
    stats = film.yearStats || {},
    finish = frame >= finishStart;
  return (
    <AbsoluteFill
      style={{
        background: "#111317",
        color: "#faf7f1",
        fontFamily: '"Anipic Roboto",Roboto,Arial,sans-serif',
        overflow: "hidden",
      }}
    >
      {!finish && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 20% 30%,#67331d66,transparent 65%)",
            }}
          />
          {entries.slice(0, 12).map((c, i) => {
            const cw = (portrait ? 230 : 290) * u,
              x = i % 2 ? w * 0.78 : -cw * 0.25,
              y =
                ((((i * 0.23 * h - frame * 1.3) % (h + cw)) + h + cw) %
                  (h + cw)) -
                cw;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: cw,
                  height: cw * 1.2,
                  borderRadius: 18 * u,
                  overflow: "hidden",
                  opacity: 0.38,
                  transform: `perspective(1600px) rotateY(${i % 2 ? -12 : 12}deg) rotateZ(${i % 2 ? 6 : -6}deg)`,
                }}
              >
                <Img
                  src={c.src}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            );
          })}
          {current && (
            <div
              key={index}
              style={{
                position: "absolute",
                left: w * (portrait ? 0.12 : 0.27),
                top: h * 0.14,
                width: w * (portrait ? 0.76 : 0.46),
                height: h * 0.65,
                borderRadius: 30 * u,
                overflow: "hidden",
                opacity: entrance,
                transform: `perspective(2000px) translateY(${(1 - entrance) * 120 * u}px) rotateY(${(1 - entrance) * -14}deg) scale(${0.91 + 0.09 * entrance})`,
                boxShadow: "0 40px 100px #0009",
              }}
            >
              <Img
                src={current.src}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${1.03 + local * 0.018})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(transparent 40%,#111317e8)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 40 * u,
                  right: 35 * u,
                  bottom: 38 * u,
                }}
              >
                <span
                  style={{
                    color: "#f5b583",
                    fontSize: 19 * u,
                    letterSpacing: 3,
                  }}
                >
                  {String(index + 1).padStart(2, "0")} / {entries.length}
                </span>
                <h1
                  style={{
                    fontSize: (portrait ? 86 : 80) * u,
                    lineHeight: 1.05,
                    margin: "16px 0 0",
                    letterSpacing: -3 * u,
                  }}
                >
                  {current.title || current.name}
                </h1>
              </div>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: 45 * u,
              top: 38 * u,
              fontSize: 25 * u,
              fontWeight: 650,
              letterSpacing: 2,
            }}
          >
            {film.year}
          </div>
          <div
            style={{
              position: "absolute",
              left: w * 0.12,
              right: w * 0.12,
              bottom: h * 0.1,
              height: 3 * u,
              background: "#ffffff18",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(frame / finishStart) * 100}%`,
                background: "#eb651c",
              }}
            />
          </div>
        </>
      )}
      {finish && (
        <PhotoConstellation
          photos={entries}
          frame={frame - finishStart}
          fps={FPS}
          width={w}
          height={h}
          duration={finishFrames / FPS}
          logoSrc={staticFile("spa-logo.png")}
          title={String(film.year)}
        />
      )}
      {finish && (
        <div
          style={{
            position: "absolute",
            left: w * 0.06,
            right: w * 0.06,
            top: 45 * u,
            display: "flex",
            justifyContent: "center",
            gap: (portrait ? 25 : 60) * u,
            opacity: ease((frame - finishStart) / FPS),
          }}
        >
          {[
            [stats.adopted, "Adoptions"],
            [stats.dogs, "Chiens"],
            [stats.cats, "Chats"],
          ]
            .filter(([n]) => typeof n === "number")
            .map(([n, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <strong
                  style={{
                    fontSize: 55 * u,
                    color: "#f7a970",
                    display: "block",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(n * ease((frame - finishStart) / FPS / 1.8))}
                </strong>
                <span style={{ fontSize: 19 * u, color: "#d8cabe" }}>{l}</span>
              </div>
            ))}
        </div>
      )}
    </AbsoluteFill>
  );
}
