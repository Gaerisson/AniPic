import React from "react";
import {
  AbsoluteFill,
  Img,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  spring,
  interpolate,
} from "remotion";
const C = {
  bg: "#101216",
  card: "#202329",
  line: "#373a40",
  ink: "#f4f1eb",
  soft: "#a9abb1",
  accent: "#f4ab70",
  sage: "#afd1b4",
};
const duration = 96;
const enter = (f, delay = 0) =>
  spring({
    frame: Math.max(0, f - delay),
    fps: 24,
    config: { damping: 22, stiffness: 90 },
  });
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        border: "1px solid " + C.line,
        borderRadius: 32,
        background: C.card,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Pill({ children, green = false }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "12px 20px",
        borderRadius: 14,
        background: green ? "#294032" : "#473325",
        color: green ? C.sage : C.accent,
        fontSize: 24,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
const chapters = [
  [
    "01",
    "Le studio photo\ndu refuge.",
    "Des images, des histoires, une équipe.",
  ],
  ["02", "Les photos\nen grand.", "Zoom, navigation et téléchargements."],
  ["03", "Tout à sa place.", "Albums privés. Sous-dossiers. Archives."],
  ["04", "Le prochain\nportrait.", "Des priorités claires pour l’équipe."],
  [
    "05",
    "Des histoires\nen mouvement.",
    "Photos + vidéos. Presets. Export MP4.",
  ],
  ["06", "Prêt à partager.", "Des visuels et des textes à personnaliser."],
  ["07", "Anipic.", "Votre refuge. Votre studio."],
];
function Chapter({ index }) {
  const f = useCurrentFrame(),
    p = enter(f),
    exit = interpolate(f, [82, 96], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    [number, title, subtitle] = chapters[index];
  const lift = (delay = 0) => ({
    opacity: enter(f, delay),
    transform: `translateY(${(1 - enter(f, delay)) * 60}px)`,
  });
  return (
    <AbsoluteFill
      style={{
        opacity: exit,
        color: C.ink,
        fontFamily: "Arial,sans-serif",
        padding: "145px 64px 160px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 25,
          letterSpacing: 5,
          color: C.accent,
          ...lift(),
        }}
      >
        <span style={{ height: 3, width: 45, background: C.accent }} />{" "}
        {index === 6 ? "CONÇU PAR GAERISSON" : "ANIPIC / " + number}
      </div>
      <h1
        style={{
          whiteSpace: "pre-line",
          fontSize: index === 6 ? 116 : 84,
          letterSpacing: -4,
          lineHeight: 1.04,
          margin: "44px 0 24px",
          ...lift(3),
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 29,
          lineHeight: 1.5,
          color: C.soft,
          margin: "0 0 55px",
          ...lift(7),
        }}
      >
        {subtitle}
      </p>
      <div style={{ ...lift(10) }}>
        {index === 0 && (
          <div style={{ height: 880, position: "relative" }}>
            {["nala", "maya", "rio"].map((name, i) => {
              const q = enter(f, 15 + i * 4);
              return (
                <Card
                  key={name}
                  style={{
                    position: "absolute",
                    width: 565,
                    height: 680,
                    left: 120 + (i - 1) * 95,
                    top: 80 + i * 55,
                    transform: `translateY(${(1 - q) * 250}px) rotate(${(i - 1) * 9}deg) scale(${0.9 + q * 0.1})`,
                    boxShadow: "0 35px 60px #0008",
                    zIndex: i === 1 ? 4 : 3,
                  }}
                >
                  <Img
                    src={staticFile("story/" + name + ".jpg")}
                    style={{ width: "100%", height: 500, objectFit: "cover" }}
                  />
                  <div
                    style={{
                      padding: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <strong
                      style={{ fontSize: 44, textTransform: "capitalize" }}
                    >
                      {name}
                    </strong>
                    <Pill>Portraits</Pill>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {index === 1 && (
          <Card style={{ height: 950, position: "relative" }}>
            <div style={{ height: 740, overflow: "hidden" }}>
              <Img
                src={staticFile("story/nala.jpg")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${interpolate(f, [10, 70], [1, 1.27], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 30,
              }}
            >
              <strong style={{ fontSize: 42 }}>Nala</strong>
              <Pill>JPEG · PNG · WebP</Pill>
            </div>
            <div style={{ color: C.soft, fontSize: 23, padding: "0 30px" }}>
              Molette pour zoomer · Un clic pour revenir à 100 %
            </div>
          </Card>
        )}
        {index === 2 && (
          <div style={{ display: "grid", gap: 28 }}>
            {[
              ["Albums privés", "Portes ouvertes / Équipe", "PRIVÉ"],
              ["Archives", "Tous les originaux conservés", "PAR ANNÉE"],
              ["Vos photos", "Stockage sur votre NAS", "SANS DOUBLONS"],
            ].map(([a, b, tag], i) => (
              <Card
                key={a}
                style={{
                  padding: 36,
                  display: "grid",
                  gap: 25,
                  ...lift(14 + i * 5),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <svg width="67" height="58" viewBox="0 0 67 58">
                    <path
                      d="M4 13h22l7 8h30v30H4z"
                      fill="none"
                      stroke={C.accent}
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <Pill>{tag}</Pill>
                </div>
                <strong style={{ fontSize: 43 }}>{a}</strong>
                <span style={{ fontSize: 28, color: C.soft }}>{b}</span>
              </Card>
            ))}
          </div>
        )}
        {index === 3 && (
          <Card style={{ padding: 34 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 35,
              }}
            >
              <strong style={{ fontSize: 34 }}>Planning photo</strong>
              <Pill green>Équipe</Pill>
            </div>
            {[
              ["Nala", "Portrait extérieur", "Urgent"],
              ["Maya", "Premier portrait", "À faire"],
              ["Rio", "Nouvelle série", "En cours"],
            ].map(([name, label, priority], i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  padding: "26px 0",
                  borderTop: "1px solid " + C.line,
                  ...lift(18 + i * 5),
                }}
              >
                <Img
                  src={staticFile("story/" + name.toLowerCase() + ".jpg")}
                  style={{
                    width: 112,
                    height: 130,
                    borderRadius: 18,
                    objectFit: "cover",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 37 }}>{name}</strong>
                  <div style={{ fontSize: 25, color: C.soft, marginTop: 12 }}>
                    {label}
                  </div>
                </div>
                <Pill>{priority}</Pill>
              </div>
            ))}
            <div
              style={{
                marginTop: 32,
                padding: 27,
                borderRadius: 18,
                background: "#14181d",
                fontSize: 28,
                color: C.sage,
              }}
            >
              Liste des animaux sans photo locale
            </div>
          </Card>
        )}
        {index === 4 && (
          <Card style={{ padding: 28 }}>
            <div
              style={{
                position: "relative",
                height: 600,
                borderRadius: 22,
                overflow: "hidden",
              }}
            >
              <Img
                src={staticFile("story/rio.jpg")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${1 + f * 0.0005})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(transparent 35%,#101216)",
                }}
              />
              <strong
                style={{
                  position: "absolute",
                  bottom: 65,
                  left: 34,
                  fontSize: 58,
                  ...lift(16),
                }}
              >
                Rio
              </strong>
              <span
                style={{
                  position: "absolute",
                  bottom: 30,
                  left: 37,
                  fontSize: 24,
                  color: C.accent,
                }}
              >
                À la rencontre de son histoire
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, margin: "24px 0" }}>
              {["nala", "maya", "rio"].map((a, i) => (
                <div
                  key={a}
                  style={{
                    flex: 1,
                    height: 120,
                    borderRadius: 14,
                    overflow: "hidden",
                    border:
                      i === Math.floor(f / 30) % 3
                        ? "3px solid " + C.accent
                        : "3px solid transparent",
                  }}
                >
                  <Img
                    src={staticFile("story/" + a + ".jpg")}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 25,
                padding: "15px 5px",
              }}
            >
              <span style={{ color: C.soft }}>Story · Cinéma · Portrait</span>
              <Pill>Exporter MP4</Pill>
            </div>
          </Card>
        )}
        {index === 5 && (
          <div style={{ position: "relative", height: 1050 }}>
            <Card
              style={{
                width: 700,
                margin: "0 auto",
                transform: `rotate(${interpolate(f, [0, 60], [-5, 0], { extrapolateRight: "clamp" })}deg)`,
                boxShadow: "0 28px 60px #0009",
              }}
            >
              <Img
                src={staticFile("story/maya.jpg")}
                style={{ width: "100%", height: 550, objectFit: "cover" }}
              />
              <div style={{ padding: 36 }}>
                <span
                  style={{
                    display: "block",
                    width: 48,
                    height: 4,
                    background: C.accent,
                    marginBottom: 27,
                  }}
                />
                <strong style={{ fontSize: 67 }}>Maya</strong>
                <p style={{ fontSize: 25, color: C.soft }}>
                  Chat · Femelle · Portrait de démonstration
                </p>
                <p style={{ fontSize: 28, color: C.accent }}>
                  Venez me rencontrer.
                </p>
              </div>
            </Card>
            <div
              style={{
                position: "absolute",
                bottom: 45,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 15,
                ...lift(24),
              }}
            >
              <Pill>Overlay configurable</Pill>
              <Pill green>Brouillon à relire</Pill>
            </div>
          </div>
        )}
        {index === 6 && (
          <>
            <Card
              style={{
                padding: 12,
                borderRadius: 26,
                transform: `perspective(1600px) rotateX(${(1 - p) * 7}deg) scale(${0.97 + p * 0.03})`,
                boxShadow: "0 40px 90px #0009",
              }}
            >
              <Img
                src={staticFile("story/interface.png")}
                style={{
                  width: "100%",
                  height: 730,
                  objectFit: "cover",
                  objectPosition: "top",
                }}
              />
            </Card>
            <div
              style={{
                marginTop: 55,
                display: "flex",
                gap: 15,
                flexWrap: "wrap",
                ...lift(20),
              }}
            >
              <Pill>Photos</Pill>
              <Pill>Albums privés</Pill>
              <Pill>Studio vidéo</Pill>
              <Pill green>Équipe SPA</Pill>
            </div>
            <p
              style={{
                fontSize: 30,
                lineHeight: 1.5,
                color: C.soft,
                marginTop: 40,
                ...lift(25),
              }}
            >
              Un outil pensé pour les images
              <br />
              et ceux qui les font vivre.
            </p>
          </>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: C.soft,
          fontSize: 22,
        }}
      >
        <span>© Gaerisson</span>
        <span>Photographies d’illustration</span>
      </div>
    </AbsoluteFill>
  );
}
export function ToolStory() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1250,
          height: 1250,
          borderRadius: "50%",
          background: "radial-gradient(circle,#81492837,transparent 66%)",
          right: -700,
          top: 100 + Math.sin(f / 100) * 80,
        }}
      />
      {chapters.map((_, i) => (
        <Sequence from={i * duration} durationInFrames={duration} key={i}>
          <Chapter index={i} />
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 64,
          right: 64,
          display: "flex",
          gap: 12,
        }}
      >
        {chapters.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 4,
              background: "#383a40",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: C.accent,
                width: `${Math.max(0, Math.min(100, ((f - i * duration) / duration) * 100))}%`,
              }}
            />
          </div>
        ))}
      </div>
      <Audio
        src={staticFile("story/ambience.wav")}
        volume={(frame) => Math.min(1, frame / 36, (672 - frame) / 48) * 0.6}
      />
    </AbsoluteFill>
  );
}
