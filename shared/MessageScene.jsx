import React from "react";
import { Clock3, CalendarDays } from "lucide-react";
import { Particles, seasonIcons } from "./Particles.jsx";
import { visualTheme, scheduleRows } from "./visual-themes.mjs";
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
  particleStyle = "auto",
}) {
  const palette = visualTheme(block.theme),
    Icon = seasonIcons[block.theme] || seasonIcons.classic,
    t = frame / fps,
    u = Math.min(w, h) / 1080,
    portrait = h > w;
  const reveal = motion ? 1 - Math.pow(1 - Math.min(1, t / 0.8), 3) : 1,
    hours = block.type === "hours";
  const rows = hours ? scheduleRows(block.body) : [];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: `radial-gradient(ellipse at ${30 + Math.sin(t * 0.15) * 8}% 10%,${palette.start},transparent 75%),linear-gradient(145deg,${palette.start},${palette.end} 80%)`,
        color: "#fff8f1",
        padding: portrait
          ? `${160 * u}px ${80 * u}px`
          : `${95 * u}px ${150 * u}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
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
        theme={block.theme}
        accent={palette.accent}
        motion={motion}
      />
      <div
        style={{
          position: "absolute",
          inset: 40 * u,
          border: "1px solid #ffffff16",
          borderRadius: 40 * u,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 35 * u}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingBottom: 100 * u,
        }}
      >
        <span
          style={{
            width: 112 * u,
            height: 112 * u,
            display: "grid",
            placeItems: "center",
            borderRadius: 32 * u,
            background: "#ffffff0e",
            border: `1px solid ${palette.accent}50`,
            color: palette.accent,
            marginBottom: 28 * u,
          }}
        >
          {hours ? (
            <Clock3 size={62 * u} strokeWidth={1.3} />
          ) : (
            <Icon size={70 * u} strokeWidth={1.3} />
          )}
        </span>
        <h1
          style={{
            fontSize: (hours ? 70 : portrait ? 84 : 102) * u,
            lineHeight: 1.08,
            letterSpacing: -2.5 * u,
            margin: "0 0 26px",
            maxWidth: "95%",
          }}
        >
          {block.title || "Au refuge"}
        </h1>
        {hours ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                !portrait && rows.length > 4 ? "1fr 1fr" : "1fr",
              gap: 12 * u,
              width: portrait ? "100%" : "78%",
              marginTop: 15 * u,
            }}
          >
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20 * u,
                  textAlign: "left",
                  padding: `${18 * u}px ${25 * u}px`,
                  borderRadius: 18 * u,
                  background: "#ffffff0d",
                  border: "1px solid #ffffff1a",
                }}
              >
                <CalendarDays size={25 * u} color={palette.accent} />
                <span style={{ fontSize: 25 * u, color: "#fff0dc", flex: 1 }}>
                  {r.day}
                </span>
                <strong
                  style={{
                    fontSize: 27 * u,
                    color: /ferm/i.test(r.hours) ? "#f2a6a6" : "#fff",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {r.hours}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          block.body && (
            <p
              style={{
                fontSize: 33 * u,
                lineHeight: 1.55,
                maxWidth: portrait ? "96%" : "80%",
                whiteSpace: "pre-wrap",
                color: "#fff2e4",
                margin: 0,
              }}
            >
              {block.body}
            </p>
          )
        )}
      </div>
      <div style={{ position: "absolute", bottom: 35 * u, opacity: reveal }}>
        {logo}
      </div>
    </div>
  );
}
