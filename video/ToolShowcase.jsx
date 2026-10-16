import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Camera,
  SlidersHorizontal,
  Printer,
  Film,
  MonitorPlay,
  FolderHeart,
  ArrowUpRight,
  Play,
  Check,
  Download,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { SignageCanvas } from "../shared/SignageCanvas.jsx";
import { showDefaults } from "../shared/signage.mjs";
const clamp = (v) => Math.max(0, Math.min(1, v)),
  ease = (v) => 1 - Math.pow(1 - clamp(v), 4);
const cuts = [0, 4, 10, 16, 22, 28, 34, 40];
const animals = [
  {
    key: "nala",
    name: "Nala",
    species: "dog",
    sex: "female",
    breed: "Golden Retriever",
  },
  {
    key: "maya",
    name: "Maya",
    species: "cat",
    sex: "female",
    breed: "Européen",
  },
  { key: "rio", name: "Rio", species: "dog", sex: "male", breed: "Berger" },
];
const ink = "#f5f1ec",
  muted = "#b6b1aa",
  accent = "#ff9d5c";
const panel = {
  border: "1px solid #ffffff20",
  borderRadius: 24,
  background: "linear-gradient(140deg,#252629eb,#15181aed)",
  boxShadow: "0 35px 100px #0006",
  overflow: "hidden",
};
function Portrait({ animal = animals[0], style = {}, children }) {
  return (
    <div style={{ ...panel, position: "absolute", ...style }}>
      <Img
        src={staticFile(`story/${animal.key}.jpg`)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {children}
    </div>
  );
}
function PhotoCard({ animal, index = 0, progress = 1, style = {} }) {
  return (
    <Portrait
      animal={animal}
      style={{
        width: 290,
        height: 405,
        borderRadius: 22,
        transform: `perspective(1600px) translateY(${(1 - progress) * (100 + index * 35)}px) rotateY(${(index - 1) * -13 + (1 - progress) * 30}deg) rotateZ(${(index - 1) * 6}deg)`,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(transparent 45%,#000c)",
        }}
      />
      <div style={{ position: "absolute", bottom: 25, left: 25, right: 25 }}>
        <span style={{ fontSize: 13, color: "#e9e3db" }}>PORTRAITS</span>
        <strong
          style={{
            display: "block",
            fontSize: 35,
            letterSpacing: -1,
            marginTop: 5,
          }}
        >
          {animal.name}
        </strong>
        <span style={{ fontSize: 13, color: "#d2ccc4" }}>
          Photos · Fiche SPA · Téléchargements
        </span>
      </div>
    </Portrait>
  );
}
function Screenshot({ name, style = {}, children }) {
  return (
    <div style={{ ...panel, position: "absolute", ...style }}>
      <div
        style={{
          height: 27,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0 13px",
          background: "#191b1d",
        }}
      >
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: i === 0 ? accent : "#ffffff35",
            }}
          />
        ))}
      </div>
      <Img
        src={staticFile(`presentation-v32/${name}.png`)}
        style={{ display: "block", width: "100%" }}
      />
      {children}
    </div>
  );
}
function Chip({ icon: Icon, children, style = {} }) {
  return (
    <div
      style={{
        ...panel,
        position: "absolute",
        borderRadius: 16,
        padding: "17px 22px",
        display: "flex",
        alignItems: "center",
        gap: 13,
        color: ink,
        fontSize: 20,
        boxShadow: "0 15px 35px #0005",
        ...style,
      }}
    >
      <Icon size={24} color={accent} />
      {children}
    </div>
  );
}
function Timeline({ t, width = 850 }) {
  return (
    <div
      style={{
        ...panel,
        position: "absolute",
        left: 0,
        bottom: 0,
        width,
        padding: 20,
        borderRadius: 18,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: muted,
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 13,
        }}
      >
        <span>Timeline</span>
        <span>1080p · MP4</span>
      </div>
      <div style={{ display: "flex", gap: 7, position: "relative" }}>
        {[...animals, ...animals].map((a, i) => (
          <div
            key={i}
            style={{
              height: 80,
              flex: 1,
              borderRadius: 7,
              overflow: "hidden",
              borderTop: `3px solid ${i % 2 ? "#83adae" : accent}`,
            }}
          >
            <Img
              src={staticFile(`story/${a.key}.jpg`)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            top: -6,
            bottom: -7,
            width: 2,
            background: "#fff",
            left: `${15 + clamp(t / 3.5) * 75}%`,
            boxShadow: "0 0 10px #fff8",
          }}
        />
      </div>
    </div>
  );
}
function LiveScreen({ portrait = false, time = 0, style = {} }) {
  const width = portrait ? 1080 : 1920,
    height = portrait ? 1920 : 1080,
    items = animals.map((a, i) => ({
      ...a,
      id: a.key,
      photo: staticFile(`story/${a.key}.jpg`),
      photos: [staticFile(`story/${a.key}.jpg`)],
      media: [{ kind: "photo", src: staticFile(`story/${a.key}.jpg`) }],
      compatibility: { dogs: "unknown", cats: "unknown", children: "unknown" },
    })),
    show = {
      enabled: true,
      refugeName: "La SPA",
      program: {
        ...showDefaults,
        orientation: portrait ? "portrait" : "landscape",
        introSeconds: 0,
        style: "cards",
        motion: "3d",
        pace: "dynamic",
        showQr: false,
        photoSeconds: 3,
        photosPerAnimal: 1,
        statsEnabled: false,
        logoEvery: 0,
      },
      items,
      stats: {},
    };
  return (
    <div
      style={{
        ...panel,
        position: "absolute",
        padding: 10,
        background: "#090b0d",
        borderRadius: portrait ? 30 : 20,
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: `${width}/${height}`,
          position: "relative",
          overflow: "hidden",
          borderRadius: portrait ? 21 : 10,
        }}
      >
        <div
          style={{
            width,
            height,
            position: "absolute",
            transform: `scale(${(style.width - 20) / width})`,
            transformOrigin: "0 0",
          }}
        >
          <SignageCanvas
            show={show}
            frame={Math.floor((time + 0.7) * 24)}
            logoSrc={staticFile("spa-logo.png")}
          />
        </div>
      </div>
    </div>
  );
}
export function ToolShowcase({ period = 0.6122, soundtrack, portrait = true }) {
  const frame = useCurrentFrame(),
    { width: w, height: h, fps } = useVideoConfig(),
    u = Math.min(w, h) / 1080,
    t = frame / fps,
    beat = t / period;
  let scene = cuts.findIndex(
    (n, i) => i < cuts.length - 1 && beat >= n && beat < cuts[i + 1],
  );
  if (scene < 0) scene = 6;
  const local = t - cuts[scene] * period,
    duration = (cuts[scene + 1] - cuts[scene]) * period,
    enter = ease(local / 0.65),
    exit = ease((duration - local) / 0.35),
    pulse = Math.exp(-(beat % 1) * 8),
    scale = portrait ? 0.98 : 1,
    sx = portrait ? 70 : 80;
  const titles = [
    "",
    "Toutes les photos.\nAu même endroit.",
    "La retouche,\nsans quitter l’outil.",
    "Du portrait\nà la publication.",
    "Des images\nqui prennent vie.",
    "Le refuge.\nEn grand.",
    "",
  ];
  const descriptions = [
    "",
    "Albums · Recherche · Favoris · Imports",
    "Réglages en direct · Presets · Recadrage",
    "Affiches A4 · QR code · Textes assistés",
    "Studio vidéo · Voix off · Bilan annuel",
    "Programme TV · Timeline · Messages",
    "",
  ];
  return (
    <AbsoluteFill
      style={{
        background: "#0e1013",
        color: ink,
        fontFamily: '"Anipic Roboto",Roboto,Arial,sans-serif',
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -100,
          background: `radial-gradient(ellipse at ${25 + Math.sin(t * 0.25) * 15}% 30%,#b95a322b,transparent 55%),radial-gradient(ellipse at 90% 80%,#66858d20,transparent 65%)`,
          transform: `scale(${1 + pulse * 0.012})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.035,
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg viewBox=%270 0 180 180%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.8%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 opacity=%27.4%27 filter=%27url(%23n)%27/%3E%3C/svg%3E')",
        }}
      />
      {scene > 0 && scene < 6 && (
        <>
          <div
            style={{
              position: "absolute",
              top: portrait ? 100 : 60,
              left: sx,
              right: sx,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Img src={staticFile("anipic-logo.svg")} style={{ width: 190 }} />
            <span style={{ fontSize: 13, letterSpacing: 3, color: muted }}>
              {String(scene).padStart(2, "0")} / 05
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              left: sx,
              top: portrait ? 260 : 300,
              width: portrait ? w - 140 : 520,
              opacity: enter * exit,
              transform: `translateY(${(1 - enter) * 35}px)`,
            }}
          >
            <div
              style={{
                width: 38,
                height: 3,
                background: accent,
                marginBottom: 25,
              }}
            />
            <h1
              style={{
                fontSize: portrait ? 77 : 62,
                letterSpacing: -2.8,
                lineHeight: 1.06,
                whiteSpace: "pre-line",
                margin: 0,
                fontWeight: 760,
              }}
            >
              {titles[scene]}
            </h1>
            <p
              style={{
                fontSize: portrait ? 22 : 18,
                color: muted,
                lineHeight: 1.7,
                maxWidth: portrait ? 850 : 390,
                marginTop: 26,
              }}
            >
              {descriptions[scene]}
            </p>
          </div>
        </>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: Math.min(1, enter * 1.3) * exit,
          transform: `translateX(${(1 - enter) * 65 - (1 - exit) * 90}px)`,
        }}
      >
        {scene === 0 && (
          <>
            <div
              style={{
                position: "absolute",
                left: portrait ? 120 : 150,
                top: portrait ? 230 : 230,
                width: portrait ? 840 : 580,
                transform: `translateY(${(1 - enter) * 30}px)`,
              }}
            >
              <Img
                src={staticFile("anipic-logo.svg")}
                style={{ width: portrait ? 700 : 540 }}
              />
              <div
                style={{
                  fontSize: portrait ? 27 : 23,
                  color: muted,
                  letterSpacing: 1,
                  marginTop: 30,
                }}
              >
                Photothèque. Création. Diffusion.
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: portrait ? 380 : 1320,
                top: portrait ? 800 : 285,
                transform: `scale(${portrait ? 1.3 : 1.25})`,
              }}
            >
              {animals.map((a, i) => (
                <PhotoCard
                  key={a.key}
                  animal={a}
                  index={i}
                  progress={ease((local - i * 0.09) / 0.8)}
                  style={{
                    left: (i - 1) * 190,
                    top: (i === 1 ? -35 : 35) + Math.sin(local * 1.1 + i) * 9,
                    zIndex: i === 1 ? 3 : 1,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: portrait ? 230 : 100,
                left: portrait ? 120 : 150,
                fontSize: 15,
                color: muted,
                letterSpacing: 2,
              }}
            >
              ANIPIC · POUR LES ÉQUIPES DU REFUGE
            </div>
          </>
        )}
        {scene === 1 && (
          <>
            <Screenshot
              name="home"
              style={{
                left: portrait ? 65 : 690,
                top: portrait ? 600 : 195,
                width: portrait ? 950 : 1130,
                height: portrait ? 760 : 680,
                transform: `perspective(2200px) rotateY(${-9 + enter * 4}deg) rotateX(3deg) scale(${1 + local * 0.012})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: portrait ? 300 : 1490,
                top: portrait ? 1050 : 520,
                transform: `scale(${portrait ? 1.1 : 0.9})`,
              }}
            >
              <PhotoCard
                animal={animals[0]}
                index={2}
                progress={enter}
                style={{
                  left: 0,
                  top: 0,
                  transform: `perspective(1400px) rotateY(${-16 + Math.sin(local * 1.1) * 6}deg) rotateZ(4deg)`,
                  boxShadow: "0 30px 80px #0009",
                }}
              />
            </div>
            <Chip
              icon={Download}
              style={{
                left: portrait ? 110 : 760,
                top: portrait ? 1450 : 850,
                transform: `translateY(${Math.sin(local * 1.5) * 7}px)`,
              }}
            >
              JPEG · PNG · WebP · Original
            </Chip>
          </>
        )}
        {scene === 2 && (
          <>
            <Screenshot
              name="editor"
              style={{
                left: portrait ? 65 : 690,
                top: portrait ? 600 : 195,
                width: portrait ? 950 : 1130,
                height: portrait ? 800 : 680,
                transform: `perspective(2300px) rotateY(-4deg) translateY(${Math.sin(local) * 6}px)`,
              }}
            />
            <div
              style={{
                ...panel,
                position: "absolute",
                left: portrait ? 360 : 1360,
                top: portrait ? 1100 : 500,
                width: portrait ? 560 : 420,
                height: portrait ? 460 : 340,
                borderRadius: 20,
                transform: "rotate(4deg)",
              }}
            >
              <Img
                src={staticFile("story/nala.jpg")}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "saturate(.65) brightness(.9)",
                }}
              />
              <Img
                src={staticFile("story/nala.jpg")}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "saturate(1.15) contrast(1.06) brightness(1.08)",
                  clipPath: `inset(0 0 0 ${20 + clamp(local / 3) * 60}%)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${20 + clamp(local / 3) * 60}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "#fff",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 15,
                  bottom: 15,
                  fontSize: 13,
                  padding: "7px 10px",
                  borderRadius: 7,
                  background: "#131517bb",
                }}
              >
                Aperçu en direct
              </div>
            </div>
            <Chip
              icon={SlidersHorizontal}
              style={{ left: portrait ? 90 : 730, top: portrait ? 1480 : 840 }}
            >
              Lumière · Couleur · Presets
            </Chip>
          </>
        )}
        {scene === 3 && (
          <>
            <div
              style={{
                position: "absolute",
                left: portrait ? 260 : 1120,
                top: portrait ? 570 : 155,
                transform: `perspective(1800px) rotateY(${-12 + enter * 6}deg) rotateZ(-5deg) translateY(${Math.sin(local) * 8}px)`,
              }}
            >
              <Img
                src={staticFile("presentation-v32/affiche.png")}
                style={{
                  height: portrait ? 900 : 750,
                  width: "auto",
                  borderRadius: 8,
                  boxShadow: "0 35px 90px #0008",
                }}
              />
            </div>
            <div
              style={{
                ...panel,
                position: "absolute",
                left: portrait ? 75 : 710,
                top: portrait ? 1150 : 590,
                width: portrait ? 450 : 360,
                padding: 24,
                transform: "rotate(4deg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    background: "#ef741e",
                    width: 35,
                    height: 35,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Camera size={20} />
                </span>
                <strong style={{ fontSize: 19 }}>La SPA</strong>
              </div>
              <strong style={{ fontSize: 27 }}>🐾 Nala</strong>
              <p style={{ fontSize: 17, color: muted, lineHeight: 1.6 }}>
                Un portrait, sa présentation et le lien vers sa fiche.
              </p>
              <div
                style={{ display: "flex", gap: 9, fontSize: 13, color: accent }}
              >
                <Sparkles size={16} />
                Texte prêt à personnaliser
              </div>
            </div>
            <Chip
              icon={Printer}
              style={{
                left: portrait ? 430 : 1460,
                top: portrait ? 1510 : 860,
              }}
            >
              A4 · Prêt à imprimer
            </Chip>
          </>
        )}
        {scene === 4 && (
          <>
            <Screenshot
              name="studio"
              style={{
                left: portrait ? 65 : 690,
                top: portrait ? 600 : 190,
                width: portrait ? 950 : 1130,
                height: portrait ? 790 : 680,
                transform: "perspective(2000px) rotateY(-4deg) rotateX(2deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: portrait ? 110 : 780,
                top: portrait ? 1290 : 750,
                transform: `translateY(${Math.sin(local * 1.3) * 5}px)`,
              }}
            >
              <Timeline t={local} width={portrait ? 860 : 950} />
            </div>
            <Chip
              icon={Film}
              style={{ left: portrait ? 180 : 840, top: portrait ? 1500 : 885 }}
            >
              Portraits · Bilan annuel · Voix off
            </Chip>
          </>
        )}
        {scene === 5 && (
          <>
            <LiveScreen
              time={local}
              style={{
                left: portrait ? 65 : 720,
                top: portrait ? 650 : 230,
                width: portrait ? 950 : 1080,
                transform: `perspective(2200px) rotateY(${-9 + enter * 3}deg) rotateX(2deg)`,
              }}
            />
            <LiveScreen
              portrait
              time={local}
              style={{
                left: portrait ? 690 : 1570,
                top: portrait ? 1010 : 470,
                width: portrait ? 300 : 250,
                transform: "perspective(1800px) rotateY(-10deg) rotateZ(5deg)",
              }}
            />
            <Chip
              icon={MonitorPlay}
              style={{ left: portrait ? 100 : 780, top: portrait ? 1430 : 880 }}
            >
              TV · Portrait & paysage · Lien web
            </Chip>
            <div
              style={{
                position: "absolute",
                left: portrait ? 130 : 790,
                top: portrait ? 1280 : 840,
                width: portrait ? 520 : 600,
                height: 3,
                background: "#ffffff20",
              }}
            >
              <i
                style={{
                  display: "block",
                  height: 3,
                  width: `${clamp(local / duration) * 100}%`,
                  background: accent,
                }}
              />
            </div>
          </>
        )}
        {scene === 6 && (
          <>
            <div
              style={{
                position: "absolute",
                left: portrait ? 120 : 270,
                top: portrait ? 350 : 270,
                width: portrait ? 840 : 1380,
                textAlign: "center",
                transform: `scale(${0.96 + enter * 0.04})`,
              }}
            >
              <Img
                src={staticFile("anipic-logo.svg")}
                style={{ width: portrait ? 730 : 600 }}
              />
              <p
                style={{
                  fontSize: portrait ? 28 : 23,
                  color: muted,
                  margin: "35px 0 55px",
                }}
              >
                Photos. Outils. Créations. Un seul espace.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: portrait
                    ? "repeat(2,1fr)"
                    : "repeat(3,1fr)",
                  gap: 14,
                  maxWidth: portrait ? 800 : 1100,
                  margin: "0 auto",
                }}
              >
                {[
                  [Camera, "Photothèque"],
                  [CalendarCheck, "Planning photo"],
                  [SlidersHorizontal, "Retouche"],
                  [Printer, "Affiches"],
                  [Film, "Studio vidéo"],
                  [MonitorPlay, "Écran TV"],
                ].map(([Icon, label], i) => (
                  <div
                    key={label}
                    style={{
                      ...panel,
                      boxShadow: "none",
                      borderRadius: 15,
                      padding: "23px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 13,
                      fontSize: 18,
                      opacity: ease((local - 0.2 - i * 0.05) / 0.45),
                      transform: `translateY(${(1 - ease((local - 0.2 - i * 0.05) / 0.45)) * 25}px)`,
                    }}
                  >
                    <Icon size={23} color={accent} />
                    {label}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 55,
                  fontSize: 17,
                  color: muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                Gaerisson × Codex <span style={{ color: accent }}>·</span>{" "}
                github.com/Gaerisson/AniPic <ArrowUpRight size={17} />
              </div>
            </div>
          </>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: portrait ? 90 : 48,
          left: sx,
          right: sx,
          display: "flex",
          gap: 8,
        }}
      >
        {cuts.slice(0, -1).map((b, i) => (
          <div
            key={i}
            style={{
              height: 2,
              flex: cuts[i + 1] - b,
              background: "#ffffff13",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${clamp((beat - b) / (cuts[i + 1] - b)) * 100}%`,
                background: accent,
              }}
            />
          </div>
        ))}
      </div>
      {soundtrack && (
        <Audio
          src={soundtrack}
          volume={(f) =>
            0.82 *
            Math.max(
              0,
              Math.min(
                1,
                f / (fps * 0.2),
                (40 * period * fps - f) / (fps * 0.65),
              ),
            )
          }
        />
      )}
    </AbsoluteFill>
  );
}
