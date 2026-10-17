import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhotoConstellation } from "../shared/PhotoConstellation.jsx";
import { annualLayout } from "../shared/annual-layout.mjs";
import { filmDuration, FPS } from "./timing.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v)),
  ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
export function AnnualMosaic({ film }) {
  const frame = useCurrentFrame(),
    { width: w, height: h } = useVideoConfig(),
    u = Math.min(w, h) / 1080,
    portrait = h > w;
  const entries = film.clips.filter((c) => c.kind === "photo"),
    total = filmDuration(film),
    finishStart = Math.max(1, Math.floor(total * 0.68)),
    finishFrames = total - finishStart;
  const step = finishStart / Math.max(1, entries.length),
    index = Math.min(entries.length - 1, Math.floor(frame / step)),
    local = (frame - index * step) / FPS,
    current = entries[index],
    finish = frame >= finishStart;
  const entrance = film.motion === "off" ? 1 : ease(local / 0.55),
    layout = annualLayout(w, h),
    stats = film.yearStats || {},
    message = film.annualMessage?.trim() || String(film.year);
  const words = message.split(/\s+/),
    lines = [""];
  for (const word of words) {
    const i = lines.length - 1;
    if (
      (lines[i] + " " + word).length > (portrait ? 32 : 55) &&
      lines.length < 2
    )
      lines.push(word);
    else lines[i] += (lines[i] ? " " : "") + word;
  }
  const messageSize = Math.min(
    (portrait ? 54 : 39) * u,
    (w * 0.82) / (Math.max(...lines.map((l) => l.length), 1) * 0.58),
  );
  return (
    <AbsoluteFill
      style={{
        background: "#111317",
        color: "#faf7f1",
        fontFamily: '"Anipic Roboto",Roboto,Arial,sans-serif',
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 25% 25%,#67331d50,transparent 65%)",
        }}
      />
      {!finish && (
        <>
          {film.annualSidePhotos !== false &&
            entries.length > 1 &&
            layout.rails.map((rail, lane) => {
              const stride =
                  (portrait ? rail.cardWidth : rail.cardHeight) + rail.gap,
                slots = Math.ceil((portrait ? w : h) / stride) + 2,
                cycle = slots * stride,
                offset =
                  film.motion === "off"
                    ? 0
                    : frame * (portrait ? 0.45 : 0.5) * u;
              return (
                <div
                  key={lane}
                  style={{
                    position: "absolute",
                    left: rail.x,
                    top: rail.y,
                    width: rail.width,
                    height: rail.height,
                    overflow: "hidden",
                    opacity: portrait ? 0.62 : 0.4,
                    maskImage: portrait
                      ? "linear-gradient(90deg,transparent,black 8%,black 92%,transparent)"
                      : "linear-gradient(transparent,black 14%,black 86%,transparent)",
                  }}
                >
                  {Array.from({ length: slots }, (_, i) => {
                    const position =
                        ((((i * stride + offset * (lane ? -1 : 1)) % cycle) +
                          cycle) %
                          cycle) -
                        stride,
                      photo = entries[(i * 2 + lane) % entries.length];
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: portrait ? position : rail.gap / 2,
                          top: portrait ? rail.gap / 2 : position,
                          width: rail.cardWidth,
                          height: rail.cardHeight,
                          borderRadius: 16 * u,
                          overflow: "hidden",
                          border: "1px solid #ffffff18",
                          transform: `perspective(1800px) rotateY(${portrait ? 0 : lane ? -7 : 7}deg)`,
                          boxShadow: "0 12px 30px #0004",
                        }}
                      >
                        <Img
                          src={photo.src}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: `${photo.focusX ?? 50}% ${photo.focusY ?? 50}%`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          {current && (
            <div
              key={index}
              style={{
                position: "absolute",
                ...layout.main,
                borderRadius: 28 * u,
                overflow: "hidden",
                opacity: entrance,
                transform: `perspective(2000px) translateY(${(1 - entrance) * 40 * u}px) rotateY(${(1 - entrance) * -6}deg) scale(${0.97 + 0.03 * entrance})`,
                boxShadow: "0 30px 80px #0007",
                background: "#17191c",
                border: "1px solid #ffffff1c",
              }}
            >
              <Img
                src={current.src}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(30px)",
                  opacity: 0.24,
                  transform: "scale(1.1)",
                }}
              />
              <Img
                src={current.src}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: current.fit || "contain",
                  objectPosition: `${current.focusX ?? 50}% ${current.focusY ?? 50}%`,
                  transform:
                    film.motion === "off"
                      ? "none"
                      : `scale(${1 + Math.min(local, 6) * 0.003})`,
                }}
              />
              <AbsoluteFill
                style={{
                  background: "linear-gradient(transparent 48%,#101216e8)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 32 * u,
                  right: 30 * u,
                  bottom: 30 * u,
                }}
              >
                <span
                  style={{
                    color: "#f5b583",
                    fontSize: 17 * u,
                    letterSpacing: 3,
                  }}
                >
                  {String(index + 1).padStart(2, "0")} / {entries.length}
                </span>
                <h1
                  style={{
                    color: "#faf7f1",
                    fontFamily: "inherit",
                    fontSize: Math.min(
                      (portrait ? 68 : 66) * u,
                      (layout.main.width /
                        Math.max(
                          5,
                          (current.title || current.name || "").length,
                        )) *
                        1.5,
                    ),
                    lineHeight: 1.08,
                    margin: "12px 0 0",
                    letterSpacing: -1.5 * u,
                  }}
                >
                  {current.title || current.name}
                </h1>
                {current.sourcePhoto && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 10 * u,
                      color: "#d9cfc3",
                      fontSize: 13 * u,
                    }}
                  >
                    Photo du site SPA
                  </span>
                )}
              </div>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: w * 0.055,
              top: h * 0.045,
              fontSize: 27 * u,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {film.year}
          </div>
          <div
            style={{
              position: "absolute",
              left: w * 0.055,
              right: w * 0.055,
              bottom: h * 0.035,
              height: 3 * u,
              background: "#ffffff16",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${clamp(frame / finishStart) * 100}%`,
                background: film.accentColor || "#eb651c",
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
          logoScale={portrait ? 0.91 : 0.86}
          animation={film.logoAnimation || "fade"}
          particleStyle={film.particleStyle || "auto"}
          particleDensity={film.particleDensity ?? 35}
          particleSpeed={film.particleSpeed ?? 40}
          backgroundTheme={film.backgroundTheme || "classic"}
          title=""
          motion={film.motion !== "off"}
        />
      )}
      {finish && film.annualStats !== false && (
        <div
          style={{
            position: "absolute",
            left: w * 0.06,
            right: w * 0.06,
            top: 42 * u,
            display: "flex",
            justifyContent: "center",
            gap: (portrait ? 25 : 55) * u,
            opacity: ease((frame - finishStart) / FPS),
          }}
        >
          {[
            [stats.adopted, "Adoptions"],
            [stats.dogs, "Chiens"],
            [stats.cats, "Chats"],
            [stats.other, "NAC"],
          ]
            .filter(([n]) => typeof n === "number")
            .map(([n, label]) => (
              <div
                key={label}
                style={{ textAlign: "center", minWidth: 70 * u }}
              >
                <strong
                  style={{
                    fontSize: 49 * u,
                    color: "#f7a970",
                    display: "block",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(n * ease((frame - finishStart) / FPS / 1.6))}
                </strong>
                <span style={{ fontSize: 18 * u, color: "#d8cabe" }}>
                  {label}
                </span>
              </div>
            ))}
        </div>
      )}
      {finish && (
        <div
          style={{
            position: "absolute",
            left: w * 0.07,
            right: w * 0.07,
            bottom: h * (portrait ? 0.085 : 0.045),
            textAlign: "center",
            opacity: ease(((frame - finishStart) / finishFrames - 0.58) / 0.22),
            transform: `translateY(${(1 - ease(((frame - finishStart) / finishFrames - 0.58) / 0.22)) * 15 * u}px)`,
          }}
        >
          <div
            style={{
              fontSize: messageSize,
              fontWeight: 700,
              lineHeight: 1.16,
              letterSpacing: -0.8 * u,
            }}
          >
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          {film.annualMessageSubtitle && (
            <div
              style={{
                fontSize: Math.min(
                  21 * u,
                  (w * 0.8) /
                    Math.max(1, film.annualMessageSubtitle.length * 0.55),
                ),
                lineHeight: 1.4,
                color: "#d8cabe",
                marginTop: 12 * u,
              }}
            >
              {film.annualMessageSubtitle}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
}
