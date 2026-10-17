import React from "react";
import { PawPrint, Snowflake, Egg, Sun, Star } from "lucide-react";
export function Pumpkin({ size = 24, ...props }) {
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
export const seasonIcons = {
  classic: PawPrint,
  halloween: Pumpkin,
  christmas: Snowflake,
  easter: Egg,
  summer: Sun,
};
export function Particles({
  frame = 0,
  fps = 24,
  width = 1920,
  height = 1080,
  density = 35,
  speed = 40,
  style = "auto",
  theme = "classic",
  accent = "#f8b075",
  motion = true,
}) {
  const t = motion ? frame / fps : 0,
    u = Math.min(width, height) / 1080;
  const kind =
    style === "auto"
      ? theme === "christmas"
        ? "snow"
        : theme === "classic"
          ? "paws"
          : "season"
      : style;
  if (kind === "none" || !density) return null;
  const Icon =
    kind === "snow"
      ? Snowflake
      : kind === "stars"
        ? Star
        : kind === "paws"
          ? PawPrint
          : seasonIcons[theme] || PawPrint;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: Math.round(density * 0.65) }, (_, i) => {
        const fall =
          ((i * 19.37 + t * (0.15 + speed / 85) * (2 + (i % 4))) % 116) - 8;
        const size =
          (kind === "bokeh"
            ? 18 + (i % 5) * 11
            : kind === "snow"
              ? 4 + (i % 5) * 3
              : 12 + (i % 4) * 10) * u;
        const color =
          kind === "snow"
            ? "#ffffff"
            : kind === "confetti"
              ? [accent, "#e3bdff", "#a8e0d6", "#ffe5ac"][i % 4]
              : accent;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${((i * 37.79 + Math.sin(t * 0.35 + i) * 1.8) % 104) - 2}%`,
              top: `${fall}%`,
              width: size,
              height: size,
              color,
              opacity:
                kind === "snow"
                  ? 0.25 + (i % 3) * 0.15
                  : kind === "bokeh"
                    ? 0.12
                    : 0.12 + (i % 3) * 0.07,
              transform: `rotate(${i * 31 + t * (i % 2 ? 7 : -8)}deg)`,
              filter: kind === "bokeh" ? `blur(${4 * u}px)` : undefined,
            }}
          >
            {["snow", "dust", "bokeh", "confetti"].includes(kind) ? (
              <i
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  borderRadius: kind === "confetti" ? 2 : "50%",
                  background: color,
                  boxShadow:
                    kind === "dust" ? `0 0 ${16 * u}px ${accent}` : undefined,
                }}
              />
            ) : (
              <Icon size={size} strokeWidth={1.3} />
            )}
          </span>
        );
      })}
    </div>
  );
}
