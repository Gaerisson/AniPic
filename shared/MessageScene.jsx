import React from "react";
import { PawPrint, Snowflake, Sun, Egg, TreePine } from "lucide-react";
function Pumpkin({ size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path d="M31 17c-7-5-20 0-22 13-4 17 8 26 17 23 4 3 8 3 12 0 9 3 22-8 17-24-3-12-15-17-23-12Z" />
      <path d="M32 17c-7 6-8 26-5 36m5-36c7 6 8 26 5 36m-5-36c-3-7 0-11 7-12" />
      <path d="m18 32 7-3 1 6Zm20-3 7 3-8 3ZM23 42l6 4 3-4 3 4 7-4" />
    </svg>
  );
}
export function MessageScene({
  block,
  frame,
  fps,
  width: w,
  height: h,
  logo,
  motion = true,
  particleDensity = 35,
  particleSpeed = 40,
}) {
  const themes = {
      classic: ["#ee975e", PawPrint],
      halloween: ["#ef7829", Pumpkin],
      christmas: ["#c6dbcf", Snowflake],
      easter: ["#d8b5dc", Egg],
      summer: ["#ffbd59", Sun],
    },
    [accent, Icon] = themes[block.theme] || themes.classic,
    t = frame / fps,
    u = Math.min(w, h) / 1080,
    reveal = motion ? Math.min(1, t / 0.7) : 1,
    n = Math.round(14 + particleDensity * 0.65),
    speed = 0.12 + particleSpeed / 100;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: `radial-gradient(ellipse at ${30 + Math.sin(t * 0.25) * 8}% 10%,${accent}30,transparent 60%),radial-gradient(ellipse at 85% 90%,${accent}18,#101318 75%)`,
        color: "#faf7f1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: w * 0.1,
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 50 * u,
          border: `1px solid ${accent}20`,
          borderRadius: 50 * u,
        }}
      />
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${((i * 39.19) % 104) - 2}%`,
            top: `${((i * 17.83 + (motion ? t * speed * (3 + (i % 3)) : 0)) % 112) - 6}%`,
            color: accent,
            opacity: i % 4 === 0 ? 0.16 : 0.09,
            transform: `rotate(${i * 31 + (motion ? Math.sin(t * 0.5 + i) * 20 : 0)}deg)`,
            filter: i % 9 === 0 ? `blur(${2 * u}px)` : "none",
          }}
        >
          {i % 3 === 0 ? (
            <i
              style={{
                display: "block",
                width: (2 + (i % 4)) * u,
                height: (2 + (i % 4)) * u,
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 ${20 * u}px ${accent}70`,
              }}
            />
          ) : (
            <Icon size={(18 + (i % 4) * 12) * u} strokeWidth={1} />
          )}
        </div>
      ))}
      <div
        style={{
          width: 138 * u,
          height: 138 * u,
          display: "grid",
          placeItems: "center",
          borderRadius: 42 * u,
          border: `1px solid ${accent}50`,
          background: `linear-gradient(140deg,${accent}24,${accent}05)`,
          boxShadow: `0 15px 80px ${accent}10`,
          color: accent,
          marginBottom: 42 * u,
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 40 * u}px) rotate(${motion ? Math.sin(t) * 2 : 0}deg)`,
        }}
      >
        <Icon size={80 * u} strokeWidth={1.2} />
      </div>
      <h1
        style={{
          fontSize: (h > w ? 94 : 112) * u,
          lineHeight: 1.06,
          letterSpacing: -3 * u,
          maxWidth: w * 0.79,
          margin: 0,
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 50 * u}px)`,
        }}
      >
        {block.title || "Au refuge"}
      </h1>
      {block.body && (
        <p
          style={{
            fontSize: 34 * u,
            lineHeight: 1.6,
            maxWidth: w * 0.72,
            whiteSpace: "pre-wrap",
            color: "#dfd5ca",
            marginTop: 38 * u,
            opacity: reveal,
            transform: `translateY(${(1 - reveal) * 65 * u}px)`,
          }}
        >
          {block.body}
        </p>
      )}
      <div style={{ position: "absolute", bottom: 55 * u, opacity: reveal }}>
        {logo}
      </div>
    </div>
  );
}
