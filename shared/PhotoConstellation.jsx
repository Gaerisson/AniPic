import React from "react";
import { Particles } from "./Particles.jsx";
import { visualTheme } from "./visual-themes.mjs";
import { mosaicPoints } from "../video/spa-mosaic.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
export function PhotoConstellation({
  photos,
  frame,
  fps = 24,
  width: w,
  height: h,
  logoSrc = "/spa-logo.png",
  motion = true,
  dynamic = true,
  duration = 8,
  title = "",
  photoBlend = 65,
  animation = "fade",
  particleDensity = 35,
  particleSpeed = 40,
  logoScale = 1,
  particleStyle = "auto",
  backgroundTheme = "classic",
}) {
  const t = frame / fps,
    portrait = h > w,
    u = Math.min(w, h) / 1080;
  const gather = motion ? ease((t - duration * 0.32) / (duration * 0.3)) : 1;
  const reveal = motion ? ease((t - duration * 0.69) / (duration * 0.2)) : 1;
  const logoW =
      Math.min(w * 0.6, h * 0.62) * Math.max(0.5, Math.min(1, logoScale)),
    logoH = (logoW * 599) / 542;
  const ox = (w - logoW) / 2,
    oy = (h - logoH) / 2 + 10 * u,
    tile = logoW / 12.4;
  if (animation !== "mosaic") {
    const fade = motion ? ease(t / Math.min(1.1, duration * 0.19)) : 1,
      cells = 90,
      level = Math.max(0, Math.min(85, photoBlend)) / 100;
    const palette = visualTheme(backgroundTheme),
      revealProgress = motion ? ease(t / Math.min(1.7, duration * 0.3)) : 1;
    const transform =
      animation === "bloom"
        ? `scale(${0.84 + 0.16 * revealProgress})`
        : animation === "prism"
          ? `perspective(1800px) rotateY(${(1 - revealProgress) * 35}deg) scale(${0.93 + 0.07 * revealProgress})`
          : undefined;
    const clip =
      animation === "sweep"
        ? `inset(0 ${(1 - revealProgress) * 100}% 0 0)`
        : undefined;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          isolation: "isolate",
          background: `radial-gradient(ellipse at 50% 44%,${palette.start},${palette.end} 80%)`,
        }}
      >
        <Particles
          frame={frame}
          fps={fps}
          width={w}
          height={h}
          density={particleDensity}
          speed={particleSpeed}
          style={particleStyle}
          theme={palette.id}
          accent={palette.accent}
          motion={motion}
        />
        <div
          style={{ position: "absolute", inset: 0, transform, clipPath: clip }}
        >
          <img
            src={logoSrc}
            alt=""
            style={{
              position: "absolute",
              left: ox,
              top: oy,
              width: logoW,
              height: logoH,
              objectFit: "contain",
              opacity: fade,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: ox,
              top: oy,
              width: logoW,
              height: logoH,
              maskImage: `url("${logoSrc}")`,
              WebkitMaskImage: `url("${logoSrc}")`,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              overflow: "hidden",
              opacity: level * fade,
            }}
          >
            {photos.length > 0 &&
              Array.from({ length: cells }, (_, i) => {
                const order = (i * 37) % cells,
                  delay = 0.16 + Math.sqrt(order / cells) * 0.57,
                  appear = motion ? ease((t / duration - delay) / 0.075) : 1;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${((i % 9) / 9) * 100}%`,
                      top: `${(Math.floor(i / 9) / 10) * 100}%`,
                      width: "11.2%",
                      height: "10.2%",
                      opacity: appear,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={photos[i % photos.length].src}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: `scale(${1 + (1 - appear) * 0.25})`,
                      }}
                    />
                  </div>
                );
              })}
          </div>
          <img
            src={logoSrc}
            alt="La SPA"
            style={{
              position: "absolute",
              left: ox,
              top: oy,
              width: logoW,
              height: logoH,
              objectFit: "contain",
              opacity: fade,
              mixBlendMode: photos.length ? "screen" : "normal",
            }}
          />
        </div>
        {title && (
          <div
            style={{
              position: "absolute",
              left: w * 0.1,
              right: w * 0.1,
              bottom: h * 0.075,
              textAlign: "center",
              fontSize: (portrait ? 36 : 32) * u,
              fontWeight: 650,
              color: "#f9f6f2",
              opacity: fade,
              letterSpacing: -0.6,
            }}
          >
            {title}
          </div>
        )}
      </div>
    );
  }
  const palette = visualTheme(backgroundTheme);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: `radial-gradient(ellipse at 50% 42%,${palette.start},${palette.end} 80%)`,
      }}
    >
      <Particles
        frame={frame}
        fps={fps}
        width={w}
        height={h}
        density={particleDensity}
        speed={particleSpeed}
        style={particleStyle}
        theme={palette.id}
        accent={palette.accent}
        motion={motion}
      />
      {photos.length > 0 &&
        mosaicPoints.map((point, i) => {
          const photo = photos[i % photos.length],
            cols = portrait ? 4 : 7,
            initialW = w / cols;
          const gx = (i % cols) * initialW - initialW * 0.25,
            gy =
              Math.floor(i / cols) * (initialW * 0.8) -
              (motion ? t * (dynamic ? 80 : 24) * u : 0);
          const x = gx + (ox + point.x * logoW - tile / 2 - gx) * gather,
            y = gy + (oy + point.y * logoH - tile / 2 - gy) * gather;
          const size = initialW * 0.94 + (tile - initialW * 0.94) * gather;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: (1 - gather) * 16 * u + 2,
                overflow: "hidden",
                opacity: (0.72 + 0.28 * gather) * (1 - reveal),
                transform: `perspective(1600px) rotateY(${(1 - gather) * (i % 2 ? 8 : -8)}deg) rotateZ(${(1 - gather) * ((i % 3) - 1) * 4}deg)`,
                boxShadow: "0 8px 30px #0003",
              }}
            >
              <img
                src={photo.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          );
        })}
      <img
        src={logoSrc}
        alt=""
        style={{
          position: "absolute",
          left: ox,
          top: oy,
          width: logoW,
          height: logoH,
          objectFit: "contain",
          opacity: reveal,
        }}
      />
      {photos.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: ox,
            top: oy,
            width: logoW,
            height: logoH,
            opacity: (reveal * Math.max(0, Math.min(85, photoBlend))) / 100,
            maskImage: `url("${logoSrc}")`,
            WebkitMaskImage: `url("${logoSrc}")`,
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            overflow: "hidden",
            isolation: "isolate",
          }}
        >
          {Array.from({ length: 90 }, (_, i) => (
            <div
              key={`inside-${i}`}
              style={{
                position: "absolute",
                left: `${((i % 9) / 9) * 100}%`,
                top: `${(Math.floor(i / 9) / 10) * 100}%`,
                width: "11.2%",
                height: "10.2%",
                overflow: "hidden",
              }}
            >
              <img
                src={photos[i % photos.length].src}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${motion ? 1.04 + Math.sin(t * 0.35 + i) * 0.035 : 1})`,
                }}
              />
            </div>
          ))}
        </div>
      )}
      <img
        src={logoSrc}
        alt="La SPA"
        style={{
          position: "absolute",
          left: ox,
          top: oy,
          width: logoW,
          height: logoH,
          objectFit: "contain",
          opacity: reveal,
          mixBlendMode: photos.length ? "screen" : "normal",
        }}
      />
      {title && (
        <div
          style={{
            position: "absolute",
            left: w * 0.1,
            right: w * 0.1,
            bottom: h * 0.09,
            textAlign: "center",
            fontSize: (portrait ? 36 : 32) * u,
            fontWeight: 650,
            color: "#f9f6f2",
            opacity: reveal,
            letterSpacing: -0.6,
          }}
        >
          {title}
        </div>
      )}
    </div>
  );
}
