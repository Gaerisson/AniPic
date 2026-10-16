import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
export function Subtitles({ config }) {
  const frame = useCurrentFrame(),
    { fps, width, height } = useVideoConfig();
  if (!config?.enabled) return null;
  const cue = config.cues?.find(
    (c) => frame / fps >= c.start && frame / fps < c.end,
  );
  if (!cue) return null;
  const portrait = height > width,
    u = width / (portrait ? 720 : 1280);
  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: "8%",
        bottom: config.position === "middle" ? "42%" : 85 * u,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      <div
        style={{
          fontFamily: "Arial,sans-serif",
          fontSize: (portrait ? 27 : 34) * u,
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: "center",
          whiteSpace: "pre-line",
          color: "white",
          background:
            config.style === "box" ? "rgba(10,12,16,.85)" : "transparent",
          padding: `${12 * u}px ${22 * u}px`,
          borderRadius: 14 * u,
          textShadow: "0 2px 5px #000, 1px 0 2px #000",
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
}
