import { useEffect, useRef, useState } from "react";
import {
  Download,
  Move,
  RotateCcw,
  LoaderCircle,
  ImagePlus,
  Save,
} from "lucide-react";
import { api, apiBlob, imageUrl } from "./api.js";
import { Button, Empty } from "./ui.jsx";
import { visualThemes, particleStyles } from "../shared/visual-themes.mjs";
import {
  drawBanner,
  bannerTemplates,
  bannerPositions,
} from "./banner-render.mjs";
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image(),
      timer = setTimeout(
        () => reject(Error("Une image ne répond pas. Réessayez.")),
        45000,
      );
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(Error("Image indisponible. Changez la photo ou réessayez."));
    };
    img.src = src;
  });
const copyPositions = () => structuredClone(bannerPositions);
export default function BannerEditor({ user, overview, notify }) {
  const defaults = {
    template: "panorama",
    size: "1920x720",
    title: overview?.refugeName || "Le refuge vous attend",
    subtitle: "Une rencontre peut tout changer.",
    contacts: "",
    season: "auto",
    particles: "auto",
    density: 30,
    accent: "#ee741e",
    positions: copyPositions(),
    left: "",
    right: "",
    leftSource: "auto",
    rightSource: "auto",
    autoCutout: ["admin", "agent", "editor", "volunteer"].includes(user?.role),
    showNames: true,
  };
  const [scene, setScene] = useState(defaults),
    [animals, setAnimals] = useState([]),
    [cuts, setCuts] = useState({}),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [background, setBackground] = useState(""),
    [selected, setSelected] = useState("title"),
    [retry, setRetry] = useState(0);
  const canvas = useRef(null),
    bounds = useRef({}),
    drag = useRef(null),
    cache = useRef(new Map()),
    attempts = useRef(new Set()),
    alive = useRef(true),
    urls = useRef([]),
    processing = useRef(false),
    desired = useRef(null);
  const patch = (key, value) => setScene((s) => ({ ...s, [key]: value }));
  useEffect(() => {
    alive.current = true;
    let live = true;
    const read = async () => {
      let all = [];
      for (let page = 1; page <= 15; page++) {
        const d = await api("/animals?limit=200&sort=name&page=" + page);
        all.push(...d.items);
        if (page >= d.pages) break;
      }
      if (live)
        setAnimals(
          all.filter(
            (a) => a.cover_id || a.source_metadata?.thumbnail || a.hasSpaPhoto,
          ),
        );
    };
    if (user) read().catch((e) => setError(e.message));
    return () => {
      alive.current = false;
      live = false;
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, [user?.id]);
  const subjects = ["left", "right"].map((side) => {
    const a = animals.find((a) => a.id === scene[side]),
      local = a?.cover_id && scene[side + "Source"] !== "spa";
    return {
      side,
      animal: a,
      ref: a
        ? { kind: local ? "local" : "spa", id: local ? a.cover_id : a.id }
        : null,
      key: a ? (local ? "local:" : "spa:") + (local ? a.cover_id : a.id) : "",
      src: a
        ? local
          ? imageUrl(a.cover_id, 1280)
          : `/api/animals/${a.id}/source-photo?w=1280`
        : "",
    };
  });
  const signature = subjects.map((s) => s.key).join("|");
  desired.current = { subjects, auto: scene.autoCutout };
  useEffect(() => {
    if (
      !scene.autoCutout ||
      !["admin", "agent", "editor", "volunteer"].includes(user?.role)
    )
      return;
    const prepare = async () => {
      if (processing.current) return;
      processing.current = true;
      setBusy(true);
      try {
        while (alive.current && desired.current.auto) {
          const subject = desired.current.subjects.find(
            (s) =>
              s.ref &&
              !cache.current.has(s.key) &&
              !attempts.current.has(s.key),
          );
          if (!subject) break;
          attempts.current.add(subject.key);
          setError("");
          try {
            setStatus("Préparation de " + subject.animal.name + "…");
            const started = await api("/creative/cutouts", {
              method: "POST",
              body: subject.ref,
            });
            let job = started;
            const deadline = Date.now() + 610000;
            while (job.state !== "done") {
              if (!alive.current) return;
              if (job.state === "failed")
                throw Error(job.error || "Détourage impossible.");
              if (Date.now() > deadline)
                throw Error("Le détourage est trop long. Vérifiez le serveur.");
              setStatus(
                subject.animal.name +
                  " · " +
                  (job.stage || "Détourage en cours…"),
              );
              await new Promise((r) => setTimeout(r, 1200));
              job = await api("/creative/jobs/" + started.id);
            }
            const blob = await apiBlob(
              "/creative/cutouts/" + started.id + "/render",
              { background: "transparent", feather: 0.4 },
            );
            if (!alive.current) return;
            const url = URL.createObjectURL(blob);
            urls.current.push(url);
            cache.current.set(subject.key, url);
            setCuts(Object.fromEntries(cache.current));
          } catch (e) {
            if (alive.current) setError(e.message);
            break;
          }
        }
      } finally {
        processing.current = false;
        if (alive.current) {
          setBusy(false);
          setStatus("");
        }
      }
    };
    const timer = setTimeout(prepare, 400);
    return () => clearTimeout(timer);
  }, [signature, scene.autoCutout, retry, user?.id]);

  useEffect(() => {
    let live = true;
    setReady(false);
    const render = async () => {
      const assets = {};
      if (background) assets.background = await loadImage(background);
      assets.logo = await loadImage("/spa-logo.png");
      for (const s of subjects) {
        if (!s.animal) continue;
        assets[s.side] = await loadImage(
          scene.autoCutout ? cuts[s.key] || s.src : s.src,
        );
      }
      if (!live) return;
      const c = canvas.current;
      if (!c) return;
      bounds.current = drawBanner(
        c,
        {
          ...scene,
          leftName: subjects[0].animal?.name,
          rightName: subjects[1].animal?.name,
        },
        assets,
      );
      setReady(
        !scene.autoCutout || subjects.every((s) => !s.key || cuts[s.key]),
      );
    };
    render().catch((e) => {
      if (live) {
        setError(e.message);
        setReady(false);
      }
    });
    return () => {
      live = false;
    };
  }, [scene, signature, cuts, background]);
  const pos = scene.positions[selected];
  const pointer = (e) => {
    const rect = canvas.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.current.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.current.height,
    };
  };
  const setPosition = (key, value) =>
    setScene((s) => ({
      ...s,
      positions: {
        ...s.positions,
        [selected]: { ...s.positions[selected], [key]: value },
      },
    }));
  if (!user)
    return (
      <Empty
        title="Bannières créatives"
        text="Connectez-vous pour choisir les animaux et composer votre visuel."
      />
    );
  return (
    <div className="banner-editor">
      <header className="page-heading">
        <div>
          <span className="eyebrow">LE VISAGE DE VOTRE REFUGE</span>
          <h1>Bannières créatives</h1>
          <p>
            Animaux détourés, saisons et mise en page libre. Glissez les
            éléments sur l’aperçu.
          </p>
        </div>
        <Button
          icon={Download}
          disabled={!ready || busy}
          loading={busy}
          onClick={() => {
            setBusy(true);
            canvas.current.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob),
                  link = document.createElement("a");
                link.href = url;
                link.download = "AniPic-banniere.png";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
              } else notify("Export impossible. Réessayez.", "error");
              setBusy(false);
            }, "image/png");
          }}
        >
          Exporter le PNG
        </Button>
      </header>
      <div className="banner-workspace">
        <section className="banner-preview panel">
          <canvas
            ref={canvas}
            aria-label="Aperçu de la bannière. Réglages de position disponibles dans le panneau."
            onPointerDown={(e) => {
              const p = pointer(e),
                hit = Object.entries(bounds.current)
                  .reverse()
                  .find(
                    ([, b]) =>
                      p.x >= b.x &&
                      p.x <= b.x + b.width &&
                      p.y >= b.y &&
                      p.y <= b.y + b.height,
                  );
              const key = hit?.[0] || selected;
              setSelected(key);
              drag.current = { key, start: p, pos: scene.positions[key] };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const p = pointer(e),
                d = drag.current;
              setScene((s) => ({
                ...s,
                positions: {
                  ...s.positions,
                  [d.key]: {
                    ...d.pos,
                    x: Math.max(
                      0,
                      Math.min(
                        100,
                        d.pos.x +
                          ((p.x - d.start.x) / canvas.current.width) * 100,
                      ),
                    ),
                    y: Math.max(
                      0,
                      Math.min(
                        115,
                        d.pos.y +
                          ((p.y - d.start.y) / canvas.current.height) * 100,
                      ),
                    ),
                  },
                },
              }));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
          <p>
            <Move size={15} />
            Glisser pour placer ·{" "}
            {selected === "left"
              ? "Animal gauche"
              : selected === "right"
                ? "Animal droit"
                : selected === "logo"
                  ? "Logo SPA"
                  : "Titre"}{" "}
            sélectionné
          </p>
          {status && (
            <div className="banner-progress" role="status">
              <LoaderCircle className="spin" size={20} />
              {status}
            </div>
          )}
          {error && (
            <div className="banner-error" role="alert">
              <p>{error}</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  attempts.current.clear();
                  setRetry((x) => x + 1);
                  setError("");
                }}
              >
                Réessayer la préparation
              </Button>
            </div>
          )}
          {!ready &&
            scene.autoCutout &&
            signature.replace("|", "") &&
            !busy &&
            !error && (
              <p>
                Préparation des images… L’export sera disponible avec les
                transparences.
              </p>
            )}
        </section>
        <aside className="panel banner-settings">
          <label>
            Template
            <select
              value={scene.template}
              onChange={(e) => patch("template", e.target.value)}
            >
              {Object.entries(bannerTemplates).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select
              value={scene.size}
              onChange={(e) => patch("size", e.target.value)}
            >
              <option value="1920x720">Couverture · 1920 × 720</option>
              <option value="1600x900">Paysage · 1600 × 900</option>
              <option value="1080x1080">Carré · 1080 × 1080</option>
            </select>
          </label>
          {subjects.map((s) => (
            <div className="banner-subject" key={s.side}>
              <label>
                {s.side === "left" ? "Animal de gauche" : "Animal de droite"}
                <select
                  value={scene[s.side]}
                  onChange={(e) => patch(s.side, e.target.value)}
                >
                  <option value="">Aucun</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.cover_id ? "photo locale" : "photo SPA"}
                    </option>
                  ))}
                </select>
              </label>
              {s.animal && (
                <label>
                  Photo utilisée
                  <select
                    value={scene[s.side + "Source"]}
                    onChange={(e) => patch(s.side + "Source", e.target.value)}
                  >
                    <option value="auto">
                      {s.animal.cover_id
                        ? "Portrait local"
                        : "Photo du site SPA"}
                    </option>
                    <option value="spa">Photo du site SPA</option>
                  </select>
                </label>
              )}
            </div>
          ))}
          <label className="check">
            <input
              type="checkbox"
              checked={scene.autoCutout}
              disabled={
                !["admin", "agent", "editor", "volunteer"].includes(user?.role)
              }
              onChange={(e) => patch("autoCutout", e.target.checked)}
            />
            Détourage automatique des animaux
          </label>
          <small>
            Traitement local : le premier lancement peut télécharger le modèle
            et prendre plusieurs minutes. Les originaux sont conservés.
          </small>
          <label className="check">
            <input
              type="checkbox"
              checked={scene.showNames}
              onChange={(e) => patch("showNames", e.target.checked)}
            />
            Afficher les prénoms
          </label>
          <label>
            Titre
            <input
              maxLength={100}
              value={scene.title}
              onChange={(e) => patch("title", e.target.value)}
            />
          </label>
          <label>
            Sous-titre
            <input
              maxLength={100}
              value={scene.subtitle}
              onChange={(e) => patch("subtitle", e.target.value)}
            />
          </label>
          <label>
            Bandeau de contact
            <input
              maxLength={160}
              placeholder="Téléphone · e-mail · horaires"
              value={scene.contacts}
              onChange={(e) => patch("contacts", e.target.value)}
            />
          </label>
          <label className="button secondary">
            <ImagePlus size={16} />
            Photo de fond
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file && file.size <= 20 * 1024 ** 2) {
                  const url = URL.createObjectURL(file);
                  urls.current.push(url);
                  setBackground(url);
                } else if (file)
                  notify("Photo de fond limitée à 20 Mo.", "error");
              }}
            />
          </label>
          {background && (
            <button className="text-link" onClick={() => setBackground("")}>
              Retirer la photo de fond
            </button>
          )}
          <details open>
            <summary>Saison et ambiance</summary>
            <label>
              Saison
              <select
                value={scene.season}
                onChange={(e) => patch("season", e.target.value)}
              >
                <option value="auto">Automatique selon la date</option>
                {Object.entries(visualThemes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effet
              <select
                value={scene.particles}
                onChange={(e) => patch("particles", e.target.value)}
              >
                {Object.entries(particleStyles).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Densité
              <input
                type="range"
                min="0"
                max="100"
                value={scene.density}
                onChange={(e) => patch("density", Number(e.target.value))}
              />
            </label>
            <label>
              Accent
              <input
                type="color"
                value={scene.accent}
                onChange={(e) => patch("accent", e.target.value)}
              />
            </label>
          </details>
          <details open>
            <summary>Placer les éléments</summary>
            <label>
              Élément
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="title">Titre</option>
                <option value="logo">Logo SPA</option>
                <option value="left">Animal gauche</option>
                <option value="right">Animal droit</option>
              </select>
            </label>
            {[
              ["x", "Horizontal", 0, 100],
              ["y", "Vertical", 0, 115],
              ["scale", "Taille", 0.3, 1.6],
            ].map(([k, n, min, max]) => (
              <label key={k}>
                {n}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={k === "scale" ? 0.02 : 1}
                  value={pos[k]}
                  onChange={(e) => setPosition(k, Number(e.target.value))}
                />
              </label>
            ))}
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => patch("positions", copyPositions())}
            >
              Réinitialiser les positions
            </Button>
          </details>
          <Button
            variant="secondary"
            icon={Save}
            onClick={() => {
              try {
                localStorage.setItem(
                  "anipic-banner-template-v1",
                  JSON.stringify(scene),
                );
                notify("Votre template est mémorisé sur cet appareil.");
              } catch {
                notify("Mémorisation indisponible.", "error");
              }
            }}
          >
            Mémoriser mon template
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              try {
                const v = JSON.parse(
                  localStorage.getItem("anipic-banner-template-v1"),
                );
                if (
                  !v ||
                  !bannerTemplates[v.template] ||
                  !["1920x720", "1600x900", "1080x1080"].includes(v.size) ||
                  !Object.keys(bannerPositions).every(
                    (k) =>
                      v.positions?.[k] &&
                      ["x", "y", "scale"].every((f) =>
                        Number.isFinite(v.positions[k][f]),
                      ),
                  )
                )
                  throw Error();
                setScene({ ...defaults, ...v });
                notify("Template restauré.");
              } catch {
                notify("Aucun template enregistré.", "error");
              }
            }}
          >
            Reprendre mon template
          </Button>
        </aside>
      </div>
    </div>
  );
}
