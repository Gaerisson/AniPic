import BannerEditor from "./banner-editor.jsx";
import CanvasStudio from "./canvas-studio.jsx";
import {
  visualThemes,
  visualTheme,
  particleStyles,
} from "../shared/visual-themes.mjs";
import { drawParticles } from "../shared/canvas-particles.mjs";
import { DropArea } from "./upload-feedback.jsx";
import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Monitor } from "lucide-react";
import { api, imageUrl } from "./api.js";
import { Button, Empty } from "./ui.jsx";
const load = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(Error("Chargement trop long."));
    }, 25000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = (e) => {
      clearTimeout(timer);
      reject(e);
    };
    image.src = src;
  });
const cover = (ctx, image, x, y, w, h) => {
  const scale = Math.max(w / image.width, h / image.height),
    sw = w / scale,
    sh = h / scale;
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    x,
    y,
    w,
    h,
  );
};
function WallpaperLegacy({ user, overview, notify }) {
  const canvas = useRef(),
    [animals, setAnimals] = useState([]),
    [chosen, setChosen] = useState([]),
    [uploads, setUploads] = useState([]),
    [size, setSize] = useState("1920x1080"),
    [template, setTemplate] = useState("mosaic"),
    [color, setColor] = useState(overview?.interface.accentColor || "#e97435"),
    [title, setTitle] = useState(""),
    [subtitle, setSubtitle] = useState(""),
    [backgroundTheme, setBackgroundTheme] = useState("classic"),
    [particleStyle, setParticleStyle] = useState("auto"),
    [particleDensity, setParticleDensity] = useState(40),
    [textColor, setTextColor] = useState("#fff7ee"),
    [logo, setLogo] = useState(true),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [imageError, setImageError] = useState(""),
    [retry, setRetry] = useState(0),
    [titleX, setTitleX] = useState(95),
    [titleY, setTitleY] = useState(94),
    [fontScale, setFontScale] = useState(3.2),
    [logoScale, setLogoScale] = useState(12);
  const uploadUrls = useRef([]);
  const addImages = (input) => {
    const files = Array.from(input)
      .filter((f) => f.type.startsWith("image/") && f.size <= 20 * 1024 ** 2)
      .slice(0, 24 - chosen.length - uploads.length);
    const next = files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    uploadUrls.current.push(...next.map((u) => u.url));
    setUploads((v) => [...v, ...next]);
  };

  useEffect(() => {
    if (user)
      api("/animals?limit=60&sort=name")
        .then((d) => {
          const items = d.items.filter(
            (a) => a.cover_id || a.source_metadata?.thumbnail,
          );
          setAnimals(items);
          setChosen(items.slice(0, 6).map((a) => a.id));
        })
        .catch((e) => notify(e.message, "error"));
    return () => uploadUrls.current.forEach(URL.revokeObjectURL);
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    setReady(false);
    setImageError("");
    const render = async () => {
      const [w, h] = size.split("x").map(Number),
        c = document.createElement("canvas");
      if (!c) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d"),
        photos = [
          ...animals
            .filter((a) => chosen.includes(a.id))
            .map((a) =>
              a.cover_id
                ? imageUrl(a.cover_id, 1280)
                : `/api/animals/${a.id}/source-photo?w=1280`,
            ),
          ...uploads.map((u) => u.url),
        ].slice(0, 24);
      const images = await Promise.all(photos.map((p) => load(p)));
      if (!active) return;
      const palette = visualTheme(backgroundTheme);
      ctx.fillStyle = palette.end;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.2, 0, 0, w * 0.2, 0, w);
      glow.addColorStop(
        0,
        backgroundTheme === "classic" ? color + "66" : palette.start,
      );
      glow.addColorStop(1, "#14161c00");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      drawParticles(ctx, w, h, {
        style: particleStyle,
        theme: palette.id,
        density: particleDensity,
        accent: palette.accent,
      });
      const available = images.filter(Boolean),
        count = available.length,
        margin = w * 0.045,
        gap = w * 0.012,
        bottom = Math.max(
          h * 0.17,
          logo && template !== "logo" ? h * (logoScale / 100 + 0.06) : 0,
        );
      if (count && template !== "logo") {
        const columns =
            template === "gallery"
              ? Math.min(count, 4)
              : Math.min(
                  count,
                  Math.max(
                    1,
                    Math.round(Math.sqrt((count * w) / (h - bottom))),
                  ),
                ),
          rows = Math.ceil(count / columns),
          cellW = (w - margin * 2 - gap * (columns - 1)) / columns,
          cellH = (h - margin * 2 - bottom - gap * (rows - 1)) / rows;
        available.forEach((image, i) => {
          const rowCount = Math.min(
              columns,
              count - Math.floor(i / columns) * columns,
            ),
            offset = ((columns - rowCount) * (cellW + gap)) / 2,
            x = margin + offset + (i % columns) * (cellW + gap),
            y = margin + Math.floor(i / columns) * (cellH + gap);
          ctx.save();
          if (template === "diagonal") {
            ctx.beginPath();
            ctx.moveTo(x + cellW * 0.13, y);
            ctx.lineTo(x + cellW, y);
            ctx.lineTo(x + cellW * 0.87, y + cellH);
            ctx.lineTo(x, y + cellH);
            ctx.closePath();
            ctx.clip();
            cover(ctx, image, x, y, cellW, cellH);
          } else if (template === "editorial" && i === 0) {
            cover(
              ctx,
              image,
              margin,
              margin,
              w * 0.58,
              h - margin * 2 - bottom,
            );
          } else if (template === "editorial") {
            const sx = w * 0.66,
              sy =
                margin +
                ((i - 1) * (h - margin * 2 - bottom)) / Math.max(1, count - 1);
            cover(
              ctx,
              image,
              sx,
              sy,
              w * 0.29,
              (h - margin * 2 - bottom) / Math.max(1, count - 1) - gap,
            );
          } else if (template === "polaroid") {
            ctx.translate(x + cellW / 2, y + cellH / 2);
            ctx.rotate((i % 2 ? 1 : -1) * 0.035);
            ctx.translate(-cellW / 2, -cellH / 2);
            ctx.fillStyle = "#fff8ef";
            ctx.fillRect(-8, -8, cellW + 16, cellH + 24);
            cover(ctx, image, 0, 0, cellW, cellH);
          } else {
            ctx.beginPath();
            ctx.roundRect(x, y, cellW, cellH, w * 0.008);
            ctx.clip();
            cover(ctx, image, x, y, cellW, cellH);
          }
          ctx.restore();
        });
      }
      if (template === "logo" && count) {
        const mark = await load("/spa-logo.png");
        if (!active) return;
        const lh = Math.min(
            h * 0.78,
            ((w - margin * 2) * mark.height) / mark.width,
          ),
          lw = (lh * mark.width) / mark.height,
          lx = (w - lw) / 2,
          ly = h * 0.045;
        const collage = document.createElement("canvas");
        collage.width = Math.round(lw);
        collage.height = Math.round(lh);
        const cc = collage.getContext("2d"),
          cols = 6,
          rows = 7;
        for (let i = 0; i < cols * rows; i++)
          cover(
            cc,
            available[i % count],
            ((i % cols) * lw) / cols,
            (Math.floor(i / cols) * lh) / rows,
            lw / cols + 1,
            lh / rows + 1,
          );
        cc.globalCompositeOperation = "destination-in";
        cc.drawImage(mark, 0, 0, lw, lh);
        ctx.drawImage(mark, lx, ly, lw, lh);
        ctx.globalAlpha = 0.72;
        ctx.drawImage(collage, lx, ly);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(mark, lx, ly, lw, lh);
        ctx.globalCompositeOperation = "source-over";
      }
      if (logo && template !== "logo") {
        const mark = await load("/spa-logo.png");
        if (!active) return;
        const logoH = (h * logoScale) / 100,
          logoW = (logoH * mark.width) / mark.height;
        const ly = h * 0.94 - logoH;
        ctx.drawImage(mark, margin, ly, logoW, logoH);
      }
      ctx.fillStyle = textColor;
      ctx.shadowColor = "#0009";
      ctx.shadowBlur = h * 0.012;
      ctx.font = `600 ${(h * fontScale) / 100}px Arial`;
      ctx.textAlign = "right";
      ctx.textAlign = titleX < 35 ? "left" : titleX > 65 ? "right" : "center";
      ctx.fillText(
        title || overview?.refugeName || "",
        (w * titleX) / 100,
        (h * titleY) / 100,
        w - margin * 2,
      );
      if (subtitle) {
        ctx.font = `400 ${(h * fontScale * 0.62) / 100}px Arial`;
        ctx.fillText(
          subtitle,
          (w * titleX) / 100,
          Math.min(h * 0.96, (h * titleY) / 100 + (h * fontScale * 0.9) / 100),
          w - margin * 2,
        );
      }
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#d0c5ba";
      ctx.font = `${Math.max(11, h * 0.013)}px Arial`;
      ctx.fillText(
        overview?.interface.textDefaults?.signature || "© Gaerisson",
        margin,
        h * 0.98,
      );

      if (!active || !canvas.current) return;
      canvas.current.width = w;
      canvas.current.height = h;
      canvas.current.getContext("2d").drawImage(c, 0, 0);
      setReady(true);
    };
    render().catch(() => {
      if (active)
        setImageError(
          "Une photo n’a pas pu être chargée. Réessayez pour exporter un visuel complet.",
        );
    });
    return () => {
      active = false;
    };
  }, [
    chosen,
    uploads,
    size,
    template,
    color,
    title,
    subtitle,
    backgroundTheme,
    particleStyle,
    particleDensity,
    textColor,
    logo,
    animals,
    titleX,
    titleY,
    fontScale,
    logoScale,
    retry,
  ]);
  if (!user)
    return (
      <Empty
        icon={Monitor}
        title="Fonds d’écran du refuge"
        text="Connectez-vous pour créer un fond d’écran."
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Visuels & bannières</h1>
          <a className="text-link" href="#motion">
            Créer un fond animé avec le logo SPA →
          </a>
        </div>
        <Button
          icon={Download}
          disabled={!ready || busy}
          onClick={() => {
            setBusy(true);
            canvas.current.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = `AniPic-visuel-${size}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
              }
              setBusy(false);
            }, "image/png");
          }}
        >
          Télécharger le PNG
        </Button>
      </div>
      <div className="wallpaper-layout">
        <section className="panel wallpaper-preview">
          <canvas ref={canvas} aria-label="Aperçu du fond d’écran" />
          {!ready && (
            <div className="wallpaper-loading" role="status">
              {imageError || "Chargement des photos…"}
              {imageError && (
                <Button
                  variant="secondary"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Réessayer
                </Button>
              )}
            </div>
          )}
          {!chosen.length && !uploads.length && (
            <p>Choisissez des photos pour commencer.</p>
          )}
        </section>
        <section className="panel form-stack">
          <h2>Composition</h2>
          <label>
            Format de sortie
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="1640x624">
                Facebook · couverture · 1640 × 624
              </option>
              <option value="1200x630">
                Facebook · publication · 1200 × 630
              </option>
              <option value="1500x500">Bannière · 1500 × 500</option>
              <option value="1080x1350">
                Instagram · publication · 1080 × 1350
              </option>
              <option value="1080x1920">Story · 1080 × 1920</option>
              <option>1920x1080</option>
              <option>2560x1440</option>
              <option>3840x2160</option>
              <option>3440x1440</option>
            </select>
          </label>
          <label>
            Template
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="logo">Logo SPA · photos dans la silhouette</option>
              <option value="editorial">Éditorial · grand portrait</option>
              <option value="diagonal">Diagonales</option>
              <option value="mosaic">Mosaïque</option>
              <option value="gallery">Galerie</option>
              <option value="polaroid">Tirages photo</option>
            </select>
          </label>
          <label>
            Ambiance de saison
            <select
              value={backgroundTheme}
              onChange={(e) => setBackgroundTheme(e.target.value)}
            >
              <option value="auto">Selon la date</option>
              {Object.entries(visualThemes).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Effet de fond
            <select
              value={particleStyle}
              onChange={(e) => setParticleStyle(e.target.value)}
            >
              {Object.entries(particleStyles).map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Densité des effets · {particleDensity}%
            <input
              type="range"
              min="0"
              max="100"
              value={particleDensity}
              onChange={(e) => setParticleDensity(+e.target.value)}
            />
          </label>
          <label>
            Couleur
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label>
            Texte
            <input
              maxLength="80"
              value={title}
              placeholder={overview?.refugeName}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Sous-titre
            <input
              maxLength="120"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Une invitation, une date, un message…"
            />
          </label>
          <label>
            Couleur du texte
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
            />
          </label>
          <div className="annual-message-presets">
            {[
              "Joyeux Halloween",
              "Joyeuses fêtes",
              "Joyeuses Pâques",
              "Rencontrez nos compagnons",
            ].map((t) => (
              <button key={t} onClick={() => setTitle(t)}>
                {t}
              </button>
            ))}
          </div>
          <details className="feature-details">
            <summary>Placement et tailles</summary>
            {[
              ["Texte · horizontal", titleX, setTitleX, 0, 100],
              ["Texte · vertical", titleY, setTitleY, 5, 98],
              ["Taille du texte", fontScale, setFontScale, 1, 10],
              ["Taille du logo", logoScale, setLogoScale, 5, 30],
            ].map(([label, v, set, min, max]) => (
              <label key={label}>
                {label} · {v} %
                <input
                  type="range"
                  min={min}
                  max={max}
                  step=".5"
                  value={v}
                  onChange={(e) => set(Number(e.target.value))}
                />
              </label>
            ))}
          </details>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={logo}
              onChange={(e) => setLogo(e.target.checked)}
            />
            Logo SPA
          </label>
          <DropArea onFiles={addImages} />
          <label className="button secondary">
            <ImagePlus size={17} />
            Ajouter mes images
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addImages(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {uploads.length > 0 && (
            <Button variant="quiet" onClick={() => setUploads([])}>
              Retirer les {uploads.length} images ajoutées
            </Button>
          )}
        </section>
      </div>
      <section className="panel wallpaper-photos">
        <h2>Portraits du refuge · {chosen.length + uploads.length}/24</h2>
        <div>
          {animals.map((a) => (
            <label key={a.id}>
              <input
                type="checkbox"
                checked={chosen.includes(a.id)}
                disabled={
                  !chosen.includes(a.id) && chosen.length + uploads.length >= 24
                }
                onChange={() =>
                  setChosen((v) =>
                    v.includes(a.id)
                      ? v.filter((id) => id !== a.id)
                      : [...v, a.id],
                  )
                }
              />
              <img
                src={
                  a.cover_id
                    ? imageUrl(a.cover_id, 320)
                    : `/api/animals/${a.id}/source-photo?w=320`
                }
                alt=""
              />
              {!a.cover_id && <small className="source-origin-chip">SPA</small>}
              <span>{a.name}</span>
            </label>
          ))}
        </div>
      </section>
    </>
  );
}

export default function Wallpaper(props) {
  const [mode, setMode] = useState("banner");
  return (
    <>
      <nav className="banner-mode-tabs" aria-label="Type de visuel">
        <Button
          variant={mode === "banner" ? "" : "secondary"}
          onClick={() => setMode("banner")}
        >
          Bannières créatives
        </Button>
        <Button
          variant={mode === "duo" ? "" : "secondary"}
          onClick={() => setMode("duo")}
        >
          Duo & détourage
        </Button>
        <Button
          variant={mode === "wallpaper" ? "" : "secondary"}
          onClick={() => setMode("wallpaper")}
        >
          Mosaïques & fonds d’écran
        </Button>
      </nav>
      {mode === "banner" ? (
        <CanvasStudio {...props} workspace="banner" />
      ) : mode === "duo" ? (
        <BannerEditor {...props} />
      ) : (
        <WallpaperLegacy {...props} />
      )}
    </>
  );
}
