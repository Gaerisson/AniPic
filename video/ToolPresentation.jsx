import React from "react";
import {
  AbsoluteFill,
  Img,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
export const TRAILER_FRAMES = 240;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const smooth = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const colors = {
  bg: "#111215",
  ink: "#f4f1eb",
  accent: "#f4ab70",
  muted: "#a3a5ad",
  panel: "#202227",
  line: "#383a40",
};
const enter = (f, delay = 0) =>
  spring({
    frame: f - delay,
    fps: 24,
    config: { damping: 24, stiffness: 115 },
  });
function Stage({ duration, children }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(
          f,
          [0, 7, duration - 8, duration],
          [0, 1, 1, 0],
          clamp,
        ),
        transform: `translateY(${(1 - enter(f)) * 30}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
function Heading({ label, title, subtitle }) {
  return (
    <div style={{ position: "absolute", left: 74, right: 74, top: 252 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 24,
          fontWeight: 650,
          letterSpacing: 3,
          color: colors.accent,
          marginBottom: 23,
        }}
      >
        <span style={{ height: 2, width: 36, background: colors.accent }} />
        {label}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 94,
          fontWeight: 750,
          lineHeight: 1.07,
          letterSpacing: -4,
          whiteSpace: "pre-line",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            fontSize: 31,
            color: colors.muted,
            margin: "20px 0 0",
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
function Screen({
  src,
  label,
  left = 68,
  top = 560,
  width = 944,
  height = 932,
  angle = 0,
  pitch = 0,
  scale = 1,
  opacity = 1,
  clip,
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        opacity,
        perspective: 1900,
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 23,
          background: colors.panel,
          border: "1px solid #505157",
          overflow: "hidden",
          transform: `rotateX(${pitch}deg) rotateY(${angle}deg) scale(${scale})`,
          boxShadow: "0 40px 90px #0009",
          clipPath: clip,
        }}
      >
        <div
          style={{
            height: 38,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderBottom: "1px solid #393b42",
            background: "#24262c",
          }}
        >
          {["#d87966", "#deac60", "#79a789"].map((c) => (
            <span
              key={c}
              style={{ width: 8, height: 8, borderRadius: 8, background: c }}
            />
          ))}
          <span
            style={{
              marginLeft: 15,
              fontSize: 17,
              color: "#b9bac1",
              letterSpacing: 0.3,
            }}
          >
            {label}
          </span>
        </div>
        <div
          style={{
            height: height - 38,
            overflow: "hidden",
            background: "#17191d",
          }}
        >
          <Img
            src={staticFile(src)}
            style={{ width: "100%", display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}
function Before() {
  const f = useCurrentFrame();
  return (
    <Stage duration={40}>
      <Heading label="AVANT" title="GPIC SPA" subtitle="La première version." />
      <Screen
        src="story/before-gpic.png"
        label="GPIC SPA / accueil"
        top={570}
        height={964}
        scale={0.975 + 0.025 * enter(f, 2)}
        angle={interpolate(f, [0, 32], [3, 0], smooth)}
      />
    </Stage>
  );
}
function After() {
  const f = useCurrentFrame();
  return (
    <Stage duration={56}>
      <Heading
        label="APRÈS"
        title="Anipic."
        subtitle="Photothèque & studio du refuge"
      />
      <Screen
        src="story/after-gallery.png"
        label="Anipic / photothèque"
        top={570}
        height={970}
        angle={interpolate(f, [0, 22, 48], [-9, 0, 2], smooth)}
        scale={0.96 + 0.04 * enter(f)}
        clip={`inset(0 ${(1 - interpolate(f, [0, 12], [0, 1], smooth)) * 100}% 0 0)`}
      />
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 1590,
          color: colors.muted,
          fontSize: 29,
        }}
      >
        Photos · Albums privés · Archives
      </div>
    </Stage>
  );
}
function Photo3D() {
  const f = useCurrentFrame();
  const turn = interpolate(f, [0, 15, 33, 51, 60], [0, -12, 11, -3, 0], smooth);
  const pitch = interpolate(f, [0, 15, 33, 51, 60], [0, 4, -4, 1, 0], smooth);
  const shine = interpolate(
    f,
    [0, 15, 33, 51, 60],
    [30, 87, 15, 60, 50],
    smooth,
  );
  const card = enter(f, 2);
  return (
    <Stage duration={60}>
      <Heading label="LES PHOTOS" title={"En grand.\nEn relief."} />
      <div
        style={{
          position: "absolute",
          left: 201,
          top: 625,
          width: 678,
          height: 900,
          perspective: 1700,
        }}
      >
        <div
          style={{
            height: "100%",
            transform: `translateY(${(1 - card) * 85}px) scale(${0.94 + 0.06 * card}) rotateX(${pitch}deg) rotateY(${turn}deg)`,
            transformStyle: "preserve-3d",
            borderRadius: 26,
            background: "#202227",
            border: "1px solid #f4ab7090",
            boxShadow: "0 0 32px #f4ab7028,0 55px 95px #000b",
          }}
        >
          <div
            style={{
              height: 758,
              position: "relative",
              overflow: "hidden",
              borderRadius: "25px 25px 0 0",
            }}
          >
            <Img
              src={staticFile("story/nala.jpg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 40%",
                transform: `scale(1.04) translateX(${-turn / 2}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at ${shine}% 30%,#ffffff48,transparent 65%)`,
                opacity: 0.5,
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 23,
                bottom: 24,
                padding: "10px 16px",
                borderRadius: 8,
                color: "#ffcea3",
                background: "#17191de6",
                border: "1px solid #f4ab704d",
                fontSize: 21,
              }}
            >
              Photo récente
            </span>
          </div>
          <div style={{ padding: "20px 26px", transform: "translateZ(15px)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 33 }}>
                Nala{" "}
                <span style={{ fontSize: 25, color: colors.accent }}>♀</span>
              </strong>
              <span style={{ fontSize: 30, color: colors.accent }}>↗</span>
            </div>
            <div
              style={{
                marginTop: 15,
                paddingTop: 12,
                borderTop: "1px solid #34363d",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 20,
                color: colors.muted,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: colors.accent,
                }}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
                </svg>
                Télécharger
              </span>
              <span>3 photos</span>
            </div>
          </div>
        </div>
      </div>
      <svg
        width="45"
        height="54"
        viewBox="0 0 40 48"
        style={{
          position: "absolute",
          left: interpolate(f, [6, 15, 33, 51], [733, 823, 270, 700], smooth),
          top: interpolate(f, [6, 15, 33, 51], [1270, 870, 1180, 1340], smooth),
          opacity: interpolate(f, [3, 9, 48, 54], [0, 1, 1, 0], clamp),
          filter: "drop-shadow(0 3px 7px #000a)",
        }}
      >
        <path
          d="M4 3 L4 37 L14 28 L22 44 L29 40 L21 24 L35 24 Z"
          fill="#fff"
          stroke="#17191d"
          strokeWidth="2.5"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 1600,
          color: colors.muted,
          fontSize: 29,
        }}
      >
        Zoom · Téléchargements multiformats
      </div>
    </Stage>
  );
}
function Pages() {
  const f = useCurrentFrame();
  return (
    <Stage duration={64}>
      <Heading label="L’ÉQUIPE" title="Pour l’équipe." />
      <Screen
        src="story/team-planning.png"
        label="Planning photo"
        left={57}
        top={570}
        width={936}
        height={566}
        angle={interpolate(f, [0, 22], [-4, 0], smooth)}
        scale={0.97 + 0.03 * enter(f)}
      />
      <Screen
        src="story/video-studio.png"
        label="Studio vidéo"
        left={92}
        top={1050 - enter(f, 12) * 60}
        width={936}
        height={635}
        angle={interpolate(f, [10, 32], [5, 0], smooth)}
        opacity={enter(f, 12)}
      />
    </Stage>
  );
}
function Finale() {
  const f = useCurrentFrame();
  return (
    <Stage duration={52}>
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          top: 265,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 142, fontWeight: 750, letterSpacing: -6 }}>
          Anipic<span style={{ color: colors.accent }}>.</span>
        </div>
        <p style={{ fontSize: 35, color: colors.muted, margin: "16px 0" }}>
          La photothèque du refuge.
        </p>
      </div>
      <Screen
        src="story/after-gallery.png"
        label="Photothèque"
        left={150}
        top={565}
        width={775}
        height={765}
        angle={-8}
        scale={0.94 + 0.06 * enter(f, 2)}
      />
      <Screen
        src="story/video-studio.png"
        label="Studio vidéo"
        left={305}
        top={925}
        width={705}
        height={525}
        angle={8}
        opacity={enter(f, 7)}
      />
      <Screen
        src="story/team-planning.png"
        label="Planning photo"
        left={70}
        top={1260}
        width={665}
        height={395}
        angle={-4}
        opacity={enter(f, 11)}
      />
    </Stage>
  );
}
export function ToolTrailer() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        color: colors.ink,
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <Audio
        src={staticFile("story/ambience.wav")}
        volume={(frame) =>
          0.48 * interpolate(frame, [0, 12, 218, 240], [0, 1, 1, 0], clamp)
        }
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 80% 35%,#f4ab701c,transparent 60%),linear-gradient(#ffffff03 1px,transparent 1px),linear-gradient(90deg,#ffffff03 1px,transparent 1px)",
          backgroundSize: "auto,90px 90px,90px 90px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          top: 156,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 25,
          letterSpacing: 4,
        }}
      >
        <strong style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: 11,
              background: colors.accent,
              boxShadow: "0 0 22px #f4ab7080",
            }}
          />
          ANIPIC
        </strong>
        <span style={{ fontSize: 20, color: colors.muted, letterSpacing: 2 }}>
          NOUVELLE VERSION
        </span>
      </div>
      <Sequence from={0} durationInFrames={40}>
        <Before />
      </Sequence>
      <Sequence from={32} durationInFrames={56}>
        <After />
      </Sequence>
      <Sequence from={80} durationInFrames={60}>
        <Photo3D />
      </Sequence>
      <Sequence from={132} durationInFrames={64}>
        <Pages />
      </Sequence>
      <Sequence from={188} durationInFrames={52}>
        <Finale />
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          bottom: 141,
          borderTop: `1px solid ${colors.line}`,
          paddingTop: 23,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 20,
          color: "#878a94",
        }}
      >
        <span>© Gaerisson</span>
        <span style={{ fontSize: 17 }}>Vues de démonstration</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          bottom: 112,
          height: 2,
          background: "#303239",
        }}
      >
        <div
          style={{
            width: `${(f / (TRAILER_FRAMES - 1)) * 100}%`,
            height: "100%",
            background: colors.accent,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
