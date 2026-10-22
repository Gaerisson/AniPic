import { messageContent } from "./content-defaults.mjs";
import React, { useEffect, useRef, useMemo } from "react";
import { compatibilityLabels } from "../video/facts.mjs";
import { CompatibilityIcon } from "./compatibility-icons.mjs";
import { MessageScene } from "./MessageScene.jsx";
import {
  PhotoConstellation,
  GlassPhotoBackdrop,
} from "./PhotoConstellation.jsx";
import { showDefaults, showSize, showTimeline, sceneAt } from "./signage.mjs";
const orange = "#eb651c",
  white = "#f9f6f2",
  brown = "#70624f";
const species = { dog: "Chiens", cat: "Chats", other: "NAC" },
  sex = { male: "Mâle", female: "Femelle" };
const clamp = (v) => Math.max(0, Math.min(1, v));
export function BrandLogo({ src = "/spa-logo.png", width = 130, style = {} }) {
  return (
    <div
      style={{
        padding: width * 0.23,
        background: "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={src}
        alt="La SPA"
        style={{
          display: "block",
          width,
          height: (width * 599) / 542,
          objectFit: "contain",
          filter: "none",
          transform: "none",
        }}
      />
    </div>
  );
}
function LiveVideo({ src, style, localFrame, fps, paused, onIssue }) {
  const ref = useRef();
  const attempt = useRef({ src: "", at: -Infinity, pending: false });
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const t = localFrame / fps;
    if (Math.abs((v.currentTime || 0) - t) > 0.7) v.currentTime = t;
    if (paused) {
      v.pause();
      attempt.current.at = -Infinity;
    } else if (
      v.paused &&
      !attempt.current.pending &&
      (attempt.current.src !== src ||
        performance.now() - attempt.current.at > 3000)
    ) {
      const trying = { src, at: performance.now(), pending: true };
      attempt.current = trying;
      v.play()
        .catch((error) => {
          if (error.name === "AbortError") trying.at = -Infinity;
          else
            onIssue?.(
              error.name === "NotAllowedError"
                ? "video_autoplay"
                : "video_load",
            );
        })
        .finally(() => {
          trying.pending = false;
        });
    }
  }, [localFrame, paused, src, fps]);
  return (
    <video
      ref={ref}
      src={src}
      style={style}
      muted
      playsInline
      preload="metadata"
      onError={(e) => {
        e.currentTarget.pause();
        onIssue?.("video_load");
      }}
      onWaiting={() => onIssue?.("video_stalled")}
      onStalled={() => onIssue?.("video_stalled")}
      onPlaying={() => onIssue?.(null)}
    />
  );
}
function Stat({ value, label, progress }) {
  return (
    <div
      style={{
        padding: "32px 38px",
        borderLeft: `2px solid ${orange}`,
        background: "#ffffff09",
        borderRadius: 20,
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: 82,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -3,
          color: white,
        }}
      >
        {Math.round((value || 0) * progress)}
      </strong>
      <span style={{ fontSize: 24, color: "#d4c3b3" }}>{label}</span>
    </div>
  );
}
export function SignageCanvas({
  show,
  frame = 0,
  fps = 24,
  paused = false,
  Video = LiveVideo,
  logoSrc = "/spa-logo.png",
  onPlaybackIssue,
}) {
  const p = { ...showDefaults, ...show.program },
    size = showSize(p.orientation),
    { width: w, height: h } = size,
    portrait = h > w,
    u = Math.min(w, h) / 1080;
  const timeline = useMemo(() => showTimeline(show, fps), [show, fps]),
    scene = sceneAt(timeline, frame),
    local = scene.frame - scene.start,
    progress = clamp(local / (scene.duration - 1)),
    smoothProgress = 0.5 - Math.cos(progress * Math.PI) / 2,
    motion = p.motion !== "off",
    power = p.intensity / 100;
  const enter = motion
      ? 1 -
        Math.pow(
          1 - clamp(local / (fps * (p.pace === "dynamic" ? 0.38 : 0.6))),
          3,
        )
      : 1,
    exit = motion ? clamp((scene.duration - local) / (fps * 0.5)) : 1,
    opacity = enter * exit;
  const anim =
    p.style === "glass"
      ? undefined
      : p.transition === "slide"
        ? `translateY(${(1 - enter) * 45 * u}px)`
        : p.transition === "zoom"
          ? `scale(${0.96 + 0.04 * enter})`
          : undefined;
  const a = scene.animal,
    media = scene.media,
    isAnimal = scene.type === "animal",
    glass = p.style === "glass",
    cinema = p.style === "cinema",
    cards = p.style === "cards";
  const theme = glass || cinema || cards ? "#111317" : "#f7f3ee",
    ink = glass || cinema || cards ? white : "#241f1b";
  const common = { position: "absolute", overflow: "hidden", inset: 0 };
  const photos = useMemo(
    () =>
      show.items
        .flatMap((a) =>
          (a.media || [])
            .filter((m) => m.kind === "photo")
            .map((m) => ({ ...m, name: a.name, animalId: a.id })),
        )
        .slice(0, 18),
    [show.items],
  );
  const logo = <BrandLogo width={portrait ? 100 : 108} src={logoSrc} />;
  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        background: isAnimal ? theme : "#111317",
        color: ink,
        fontFamily: '"Anipic Roboto",Roboto,Arial,sans-serif',
        isolation: "isolate",
      }}
    >
      <div
        style={{
          ...common,
          background: `radial-gradient(ellipse at ${25 + Math.sin((frame / fps) * 0.1) * 10}% 5%, ${orange}26, transparent 65%)`,
        }}
      />
      {isAnimal ? (
        <div
          key={`${scene.start}-${a.id}`}
          style={{ ...common, opacity, transform: anim }}
        >
          {(glass || cinema) && media.kind === "photo" && (
            <img
              src={media.src}
              alt=""
              style={{
                ...common,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(50px) brightness(.34)",
                transform: "scale(1.08)",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              left: cards ? 60 * u : 0,
              top: cards ? 70 * u : 0,
              width: portrait
                ? cards
                  ? w - 120 * u
                  : w
                : w * (cinema ? 0.69 : 0.64) - (cards ? 60 * u : 0),
              height: portrait
                ? h * (cinema ? 0.66 : 0.57) - (cards ? 70 * u : 0)
                : h - (cards ? 140 * u : 0),
              borderRadius: cards ? 36 * u : 0,
              overflow: "hidden",
              boxShadow: cards ? "0 40px 100px #0008" : undefined,
              transform:
                !glass &&
                (cards || p.pace === "dynamic") &&
                motion &&
                p.motion === "3d"
                  ? `perspective(2000px) rotateY(${Math.sin(progress * Math.PI) * -5 * power}deg) rotateZ(${-1.2 * power}deg)`
                  : undefined,
            }}
          >
            {media.kind === "video" ? (
              <Video
                onIssue={onPlaybackIssue}
                src={media.src}
                localFrame={local}
                fps={fps}
                paused={paused}
                sceneStart={scene.start}
                duration={scene.duration}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: "#08090a",
                }}
              />
            ) : (
              <img
                src={media.src}
                alt={a.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform:
                    glass && motion
                      ? `scale(${1.015 + smoothProgress * 0.012 * power})`
                      : motion
                        ? `translate3d(${Math.sin(smoothProgress * Math.PI * 2) * 7 * u * power}px,${Math.cos(smoothProgress * Math.PI) * 5 * u * power}px,0) scale(${1.035 + smoothProgress * 0.045 * power})`
                        : undefined,
                  willChange: motion ? "transform" : undefined,
                  backfaceVisibility: "hidden",
                }}
              />
            )}
            {media.source && (
              <span
                style={{
                  position: "absolute",
                  bottom: 24 * u,
                  left: 24 * u,
                  background: "#111c",
                  color: "white",
                  padding: "12px 20px",
                  borderRadius: 50,
                  fontSize: 20 * u,
                }}
              >
                Photo de référence SPA
              </span>
            )}
            <div
              style={{
                position: "absolute",
                top: 30 * u,
                left: 30 * u,
                borderRadius: 40,
                padding: "13px 24px",
                background: "#111b",
                color: white,
                fontSize: 20 * u,
                letterSpacing: 1,
              }}
            >
              À RENCONTRER · {species[a.species]?.toUpperCase()}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: portrait ? h * 0.57 : 0,
              bottom: 0,
              width: portrait ? w : w * 0.36,
              padding: portrait ? "44px 64px" : "58px 60px",
              background: glass
                ? "linear-gradient(120deg,#ffffff20,#ffffff08)"
                : cinema
                  ? "#111317df"
                  : cards
                    ? "transparent"
                    : "#f7f3ee",
              backdropFilter: glass ? "blur(38px) saturate(135%)" : undefined,
              borderLeft: glass ? "1px solid #ffffff30" : undefined,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 22 * u,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24 * u,
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 18 * u,
                  letterSpacing: 3 * u,
                  textTransform: "uppercase",
                  color: glass || cinema || cards ? "#d4c3b3" : brown,
                }}
              >
                {show.refugeName}
              </span>
              {!portrait && logo}
            </div>
            <div>
              <span
                style={{ fontSize: 18 * u, color: orange, fontWeight: 700 }}
              >
                {a.status === "reserved"
                  ? "RÉSERVÉ"
                  : a.sos
                    ? "SOS · UNE FAMILLE POUR LUI"
                    : "À L’ADOPTION"}
              </span>
              <h1
                style={{
                  color: ink,
                  fontFamily: "inherit",
                  fontSize:
                    (portrait
                      ? 92
                      : Math.min(
                          110,
                          (550 / Math.max(5, a.name.length)) * 1.5,
                        )) * u,
                  lineHeight: 1.02,
                  letterSpacing: -3 * u,
                  margin: "12px 0 22px",
                  overflowWrap: "anywhere",
                }}
              >
                {a.name}
              </h1>
              <p
                style={{
                  fontSize: 25 * u,
                  lineHeight: 1.5,
                  margin: 0,
                  color: glass || cinema || cards ? "#d4c3b3" : brown,
                }}
              >
                {[sex[a.sex], a.age, a.breed].filter(Boolean).join(" · ")}
              </p>
            </div>
            {p.showFacts && (
              <p
                style={{
                  color: ink,
                  fontSize: (portrait ? 27 : 25) * u,
                  lineHeight: 1.6,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: portrait ? 4 : 5,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {a.description}
              </p>
            )}
            {p.showFacts && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 * u }}>
                {compatibilityLabels(a.compatibility)
                  .slice(0, 3)
                  .map((e) => (
                    <span
                      key={e.subject}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 9 * u,
                        fontSize: 17 * u,
                        border: `1px solid ${glass || cinema || cards ? "#ffffff30" : "#d4c3b3"}`,
                        padding: "8px 12px",
                        borderRadius: 10 * u,
                        color:
                          e.state === "yes"
                            ? glass || cinema || cards
                              ? "#8fd7b6"
                              : "#27654e"
                            : e.state === "no"
                              ? glass || cinema || cards
                                ? "#f5a1a1"
                                : "#9a3434"
                              : e.state === "conditional"
                                ? glass || cinema || cards
                                  ? "#ffc176"
                                  : "#a0570d"
                                : undefined,
                        background:
                          e.state === "yes"
                            ? "#48aa7c15"
                            : e.state === "no"
                              ? "#da555515"
                              : e.state === "conditional"
                                ? "#e79d3126"
                                : undefined,
                      }}
                    >
                      <CompatibilityIcon subject={e.subject} size={25 * u} />
                      {e.label} {e.subject}
                    </span>
                  ))}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28 * u,
                marginTop: 12 * u,
              }}
            >
              {portrait && <BrandLogo src={logoSrc} width={84 * u} />}{" "}
              {p.showQr && a.qr && (
                <>
                  <img
                    src={a.qr}
                    style={{
                      width: 152 * u,
                      height: 152 * u,
                      borderRadius: 12 * u,
                    }}
                    alt="Fiche SPA"
                  />
                  <span style={{ fontSize: 21 * u, lineHeight: 1.5 }}>
                    Faisons
                    <br />
                    <strong>connaissance.</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : ["message", "hours", "spa"].includes(scene.type) ? (
        <div style={{ ...common, opacity }}>
          <MessageScene
            block={messageContent({ ...scene.block, type: scene.type }, show)}
            frame={local}
            fps={fps}
            width={w}
            height={h}
            logo={logo}
            motion={motion}
            particleDensity={p.particleDensity}
            particleSpeed={p.particleSpeed}
            particleStyle={p.particleStyle}
          />
        </div>
      ) : scene.type === "video" ? (
        <div style={{ ...common, background: "#000", opacity }}>
          <Video
            onIssue={onPlaybackIssue}
            src={media.src}
            localFrame={local}
            fps={fps}
            paused={paused}
            sceneStart={scene.start}
            duration={scene.duration}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {scene.block.title && (
            <span
              style={{
                position: "absolute",
                left: 45 * u,
                bottom: 40 * u,
                color: white,
                fontSize: 30 * u,
                textShadow: "0 2px 15px #000",
              }}
            >
              {scene.block.title}
            </span>
          )}
        </div>
      ) : scene.type === "wallpaper" || scene.type === "logo" ? (
        p.style === "glass" && scene.type === "wallpaper" ? (
          <GlassPhotoBackdrop
            photos={photos}
            frame={local}
            fps={fps}
            width={w}
            height={h}
            logoSrc={logoSrc}
            title={p.title || show.refugeName}
            motion={motion}
          />
        ) : (
          <PhotoConstellation
            photos={photos}
            frame={local}
            fps={fps}
            width={w}
            height={h}
            logoSrc={logoSrc}
            motion={motion}
            dynamic={p.pace === "dynamic"}
            duration={scene.duration / fps}
            title={p.title || show.refugeName}
            photoBlend={p.logoPhotoBlend}
            animation={p.logoAnimation}
            particleDensity={p.particleDensity}
            particleSpeed={p.particleSpeed}
            particleStyle={p.particleStyle}
            backgroundTheme={p.backgroundTheme}
          />
        )
      ) : scene.type === "stats" ? (
        <div
          style={{
            ...common,
            background: "#151719",
            color: white,
            padding: portrait ? "180px 80px" : "100px 130px",
            opacity,
            transform: anim,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ letterSpacing: 5, fontSize: 23, color: orange }}>
                LA VIE DU REFUGE
              </p>
              <h1
                style={{
                  color: white,
                  fontFamily: "inherit",
                  fontSize: portrait ? 90 : 100,
                  lineHeight: 1.1,
                  maxWidth: 1000,
                  letterSpacing: -4,
                  margin: "20px 0",
                }}
              >
                Des rencontres.
                <br />
                De nouvelles histoires.
              </h1>
            </div>
            {!portrait && <BrandLogo src={logoSrc} width={145} />}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: portrait ? "1fr 1fr" : "repeat(4,1fr)",
              gap: 24,
              marginTop: portrait ? 110 : 90,
            }}
          >
            {[
              [
                show.stats?.adoptions,
                `Adoptions observées · ${show.stats?.year}`,
              ],
              [show.stats?.dogs, "Chiens au refuge"],
              [show.stats?.cats, "Chats au refuge"],
              [show.stats?.other, "NAC au refuge"],
            ].map(([v, l]) => (
              <Stat
                key={l}
                value={v}
                label={l}
                progress={motion ? clamp(local / (fps * 1.8)) : 1}
              />
            ))}
          </div>
          <p style={{ fontSize: 19, color: "#a99e92", marginTop: 45 }}>
            Adoptions renseignées dans la source SPA pendant l’année
            sélectionnée.
          </p>
          {portrait && (
            <div style={{ marginTop: 100 }}>
              <BrandLogo src={logoSrc} width={155} />
            </div>
          )}
        </div>
      ) : (
        <div
          style={{ ...common, background: "#111317", color: white, opacity }}
        >
          {photos.slice(0, portrait ? 10 : 16).map((m, i) => {
            const cols = portrait ? 3 : 5,
              rows = portrait ? 4 : 3,
              cw = w / cols,
              ch = h / rows;
            const float = motion
              ? Math.sin((frame / fps) * 0.5 + i) * 14 * power
              : 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: (i % cols) * cw + 14,
                  top: Math.floor(i / cols) * ch + 14 + float,
                  width: cw - 28,
                  height: ch - 28,
                  borderRadius: 24,
                  overflow: "hidden",
                  opacity: scene.type === "logo" ? 0.45 : 0.85,
                  transform:
                    motion && p.motion === "3d"
                      ? `perspective(1800px) rotateY(${Math.sin(progress * Math.PI + i) * 6 * power}deg) rotateZ(${(i % 2 ? 1 : -1) * 2 * power}deg)`
                      : undefined,
                }}
              >
                <img
                  src={m.src}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: motion
                      ? `scale(${1.04 + Math.sin(progress * Math.PI) * 0.03})`
                      : undefined,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 18,
                    left: 22,
                    fontSize: 22,
                    textShadow: "0 2px 12px #000",
                  }}
                >
                  {m.name}
                </span>
              </div>
            );
          })}
          <div
            style={{
              ...common,
              background:
                "radial-gradient(ellipse at center,#11131788,transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 30,
            }}
          >
            <BrandLogo
              src={logoSrc}
              width={portrait ? 260 : 215}
              style={{
                opacity: motion ? clamp((local - fps * 0.4) / (fps * 0.8)) : 1,
              }}
            />
            {(p.title || show.refugeName) && (
              <div
                style={{
                  background: "#111317eb",
                  borderRadius: 20,
                  padding: "22px 38px",
                  fontSize: portrait ? 42 : 40,
                  fontWeight: 650,
                  letterSpacing: -1,
                  textAlign: "center",
                  maxWidth: w * 0.8,
                }}
              >
                {p.title || show.refugeName}
              </div>
            )}
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          width: `${progress * 100}%`,
          background: orange,
          opacity: 0.8,
        }}
      />
    </div>
  );
}
