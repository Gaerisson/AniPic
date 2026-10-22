import {
  visualThemes,
  particleStyles,
  logoAnimations,
} from "../shared/visual-themes.mjs";
import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Download,
  Trash2,
  Square,
  RotateCcw,
  Film,
} from "lucide-react";
import { api, bytes, date, speciesName } from "./api.js";
import { Button } from "./ui.jsx";
import { showStyles } from "../shared/signage.mjs";
function BoundedNumber({ value, min, max, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      onChange={(e) => {
        const s = e.target.value;
        setDraft(s);
        const n = Number(s);
        if (s !== "" && Number.isInteger(n) && n >= min && n <= max)
          onChange(n);
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}
export function ShowOptions({
  program: p,
  change,
  section,
  hidden = [],
  setHidden,
}) {
  const [animals, setAnimals] = useState([]),
    [tags, setTags] = useState([]),
    [query, setQuery] = useState("");
  useEffect(() => {
    api("/media-tags")
      .then(setTags)
      .catch(() => {});
    if (setHidden)
      (async () => {
        let page = 1,
          items = [],
          total = 0;
        do {
          const r = await api(`/animals?limit=60&sort=name&page=${page++}`);
          items.push(...r.items);
          total = r.total;
        } while (items.length < total && page < 35);
        setAnimals(items);
      })().catch(() => {});
  }, []);
  const patch = (k, v) => change({ ...p, [k]: v });
  const number = (key, label, min, max) => (
    <label key={key}>
      {label}
      <BoundedNumber
        value={p[key]}
        min={min}
        max={max}
        onChange={(v) => patch(key, v)}
      />
    </label>
  );
  const check = (key, label) => (
    <label className="checkbox-label" key={key}>
      <input
        type="checkbox"
        checked={p[key]}
        onChange={(e) => patch(key, e.target.checked)}
      />
      {label}
    </label>
  );
  if (section === "schedule")
    return (
      <>
        <h3>Horaires · Europe/Paris</h3>
        {check("scheduleEnabled", "Limiter aux horaires d’accueil")}
        <div className="day-pills">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((v, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={p.days.includes(i)}
              onClick={() => {
                const days = p.days.includes(i)
                  ? p.days.filter((d) => d !== i)
                  : [...p.days, i];
                if (days.length) patch("days", days);
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="form-two">
          {[
            ["startTime", "Début"],
            ["endTime", "Fin"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                type="time"
                value={p[k]}
                onChange={(e) => patch(k, e.target.value)}
              />
            </label>
          ))}
        </div>
        <small>
          Hors horaires : écran de veille avec le logo. Un créneau peut passer
          minuit. Les exports restent complets.
        </small>
      </>
    );
  if (section === "style")
    return (
      <div className="show-options">
        <label>
          Format
          <select
            value={p.orientation}
            onChange={(e) => patch("orientation", e.target.value)}
          >
            <option value="landscape">
              Horizontal · TV / PC · 1920 × 1080
            </option>
            <option value="portrait">
              Vertical · TV / story · 1080 × 1920
            </option>
          </select>
        </label>
        {p.mode !== "wallpaper" && (
          <div className="show-style-grid">
            {showStyles.map((s) => (
              <button
                key={s.id}
                className={p.style === s.id ? "active" : ""}
                onClick={() => patch("style", s.id)}
              >
                <i className={`style-swatch ${s.id}`} />
                <strong>{s.name}</strong>
                <small>{s.detail}</small>
              </button>
            ))}
          </div>
        )}
        <label>
          Rythme visuel
          <select
            value={p.pace}
            onChange={(e) => patch("pace", e.target.value)}
          >
            <option value="gentle">Doux · accueil TV</option>
            <option value="dynamic">Dynamique · réseaux & mosaïque</option>
          </select>
        </label>
        <label>
          Animation du logo
          <select
            value={p.logoAnimation}
            onChange={(e) => patch("logoAnimation", e.target.value)}
          >
            {Object.entries(logoAnimations).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ambiance de fond
          <select
            value={p.backgroundTheme || "classic"}
            onChange={(e) => patch("backgroundTheme", e.target.value)}
          >
            <option value="auto">Selon la saison</option>
            {Object.entries(visualThemes).map(([v, t]) => (
              <option key={v} value={v}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Effet de fond
          <select
            value={p.particleStyle || "auto"}
            onChange={(e) => patch("particleStyle", e.target.value)}
          >
            {Object.entries(particleStyles).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {number("particleDensity", "Particules en arrière-plan (%)", 0, 100)}
        {number("particleSpeed", "Vitesse des particules (%)", 0, 100)}
        <label>
          Photos dans le logo SPA · {p.logoPhotoBlend ?? 55} %
          <input
            type="range"
            min="0"
            max="85"
            step="1"
            value={p.logoPhotoBlend ?? 55}
            onChange={(e) => patch("logoPhotoBlend", Number(e.target.value))}
          />
          <small>
            Le logo reste en couleur ; les portraits apparaissent dans sa
            silhouette.
          </small>
        </label>
        <label>
          Mouvement
          <select
            value={p.motion}
            onChange={(e) => patch("motion", e.target.value)}
          >
            <option value="off">Sans mouvement</option>
            <option value="gentle">Mouvement doux</option>
            <option value="3d">Relief 3D · galerie et mosaïque</option>
          </select>
        </label>
        <label>
          Intensité <span>{p.intensity} %</span>
          <input
            type="range"
            min="0"
            max="100"
            value={p.intensity}
            onChange={(e) => patch("intensity", +e.target.value)}
          />
        </label>
        {p.mode !== "wallpaper" && (
          <label>
            Transition
            <select
              value={p.transition}
              onChange={(e) => patch("transition", e.target.value)}
            >
              <option value="fade">Fondu</option>
              <option value="slide">Glissement doux</option>
              <option value="zoom">Approche</option>
            </select>
          </label>
        )}
        {p.mode !== "wallpaper" && (
          <>
            {check("showFacts", "Présentation de l’animal")}
            {check("showQr", "QR de la fiche SPA")}{" "}
          </>
        )}
        <small>
          Palette SPA · Roboto · logo intact sur fond uni, sans déformation.
        </small>
      </div>
    );
  return (
    <div className="show-options">
      <label>
        Titre des séquences logo
        <input
          value={p.title}
          maxLength={80}
          placeholder="Nom du refuge par défaut"
          onChange={(e) => patch("title", e.target.value)}
        />
      </label>
      <label>
        Type de programme
        <select value={p.mode} onChange={(e) => patch("mode", e.target.value)}>
          <option value="reception">Présentation des animaux</option>
          <option value="wallpaper">Fond animé · mosaïque et logo SPA</option>
        </select>
      </label>
      <details className="show-connection-options">
        <summary>Connexion & diagnostic sur l’écran</summary>
        <p>
          La reconnexion reste automatique. Ces options contrôlent les
          indications visibles sur le player.
        </p>
        {check("connectionBadge", "Afficher le petit statut de connexion")}
        {check("debugBadge", "Afficher les informations techniques en petit")}
      </details>
      <h3>Animaux & ordre de passage</h3>
      <div className="species-order">
        {["dog", "cat", "other"].map((s) => (
          <div key={s}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={p.species.includes(s)}
                onChange={(e) => {
                  const v = e.target.checked
                    ? [...p.species, s]
                    : p.species.filter((v) => v !== s);
                  if (v.length) patch("species", v);
                }}
              />
              {speciesName[s]}
            </label>
            {p.species.includes(s) && (
              <>
                <span>{p.species.indexOf(s) + 1}</span>
                <button
                  aria-label={`Avancer ${speciesName[s]}`}
                  disabled={!p.species.indexOf(s)}
                  onClick={() => {
                    const v = [...p.species],
                      i = v.indexOf(s);
                    [v[i - 1], v[i]] = [v[i], v[i - 1]];
                    patch("species", v);
                  }}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  aria-label={`Reculer ${speciesName[s]}`}
                  disabled={p.species.indexOf(s) === p.species.length - 1}
                  onClick={() => {
                    const v = [...p.species],
                      i = v.indexOf(s);
                    [v[i + 1], v[i]] = [v[i], v[i + 1]];
                    patch("species", v);
                  }}
                >
                  <ArrowDown size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {number("maxAnimals", "Nombre maximum d’animaux", 1, 200)}
      <label>
        Renouvellement de la sélection
        <select
          value={p.rotationMinutes}
          onChange={(e) => patch("rotationMinutes", Number(e.target.value))}
        >
          {[0, 2, 5, 10, 15, 30, 60].map((n) => (
            <option key={n} value={n}>
              {n ? `Toutes les ${n} minutes` : "Liste fixe"}
            </option>
          ))}
        </select>
        <small>
          Le lecteur recharge les données chaque minute. La sélection tourne
          parmi les animaux correspondant aux filtres.
        </small>
      </label>
      <label>
        Thème des médias
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !p.tags.includes(e.target.value))
              patch("tags", [...p.tags, e.target.value]);
          }}
        >
          <option value="">Tous les thèmes / ajouter un filtre…</option>
          {tags.map((t) => (
            <option key={t.tag}>{t.tag}</option>
          ))}
        </select>
      </label>
      {p.tags.length > 0 && (
        <div className="tag-pills">
          {p.tags.map((t) => (
            <button
              key={t}
              onClick={() =>
                patch(
                  "tags",
                  p.tags.filter((v) => v !== t),
                )
              }
            >
              {t} ×
            </button>
          ))}
        </div>
      )}
      <small>
        Avec plusieurs tags : médias possédant au moins l’un de ces thèmes.
      </small>
      <div className="form-two">
        {p.mode === "wallpaper" ? (
          <label>
            Durée de la mosaïque
            <select
              value={Math.max(8, p.photoSeconds * 2)}
              onChange={(e) =>
                patch("photoSeconds", Number(e.target.value) / 2)
              }
            >
              {Array.from({ length: 27 }, (_, i) => 8 + i * 2).map((v) => (
                <option key={v} value={v}>
                  {v} secondes
                </option>
              ))}
            </select>
          </label>
        ) : (
          number("photoSeconds", "Secondes par photo", 3, 30)
        )}
        {number("photosPerAnimal", "Photos par animal", 1, 8)}
      </div>
      {p.mode !== "wallpaper" && (
        <>
          {check("includeVideos", "Lire les vidéos autorisées sur la TV")}
          {p.includeVideos &&
            number("videoSeconds", "Durée maximale d’une vidéo (s)", 3, 60)}
        </>
      )}
      <h3>Interludes</h3>
      {p.mode !== "wallpaper" &&
        check("statsEnabled", "Afficher les statistiques")}
      <div className="form-two">
        {number("introSeconds", "Apparition du logo (s)", 0, 15)}
        {p.mode !== "wallpaper" && (
          <>
            {number("logoEvery", "Logo tous les N animaux · 0 = non", 0, 100)}
            {p.statsEnabled &&
              number("statsEvery", "Stats tous les N animaux · 0 = non", 0, 50)}
            {p.statsEnabled &&
              number("statsSeconds", "Durée des stats (s)", 3, 20)}
          </>
        )}
      </div>
      {p.mode !== "wallpaper" &&
        number("year", "Année des adoptions observées", 2000, 2100)}
      {setHidden && (
        <details>
          <summary>Masquer des animaux · {hidden.length} exclus</summary>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom"
            aria-label="Animaux à masquer"
          />
          <div className="show-animal-picks">
            {animals
              .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
              .map((a) => (
                <label className="checkbox-label" key={a.id}>
                  <input
                    type="checkbox"
                    checked={!hidden.includes(a.id)}
                    onChange={(e) =>
                      setHidden(
                        e.target.checked
                          ? hidden.filter((v) => v !== a.id)
                          : [...hidden, a.id],
                      )
                    }
                  />
                  <span>
                    {a.name}
                    <small>{speciesName[a.species]}</small>
                  </span>
                </label>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
export function MotionExports({ notify, canEdit }) {
  const [items, setItems] = useState([]),
    [trash, setTrash] = useState(false);
  const load = () => api("/motion/exports").then(setItems);
  useEffect(() => {
    let live = true;
    const fetch = () =>
      api("/motion/exports")
        .then((r) => live && setItems(r))
        .catch(() => {});
    fetch();
    const timer = setInterval(fetch, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  if (!items.length) return null;
  const action = async (v, op) => {
    try {
      await api(
        `/motion/exports/${v.id}${op === "cancel" ? "/cancel" : op === "restore" ? "/restore" : ""}`,
        {
          method: op === "delete" ? "DELETE" : "POST",
        },
      );
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <section className="panel motion-exports">
      <div className="section-heading">
        <h3>Exports de diffusion</h3>
        <button className="text-link" onClick={() => setTrash((v) => !v)}>
          {trash ? "Voir les exports" : "Corbeille"}
        </button>
      </div>
      {items
        .filter((v) => (trash ? v.state === "removed" : v.state !== "removed"))
        .map((v) => {
          let progress = 0;
          try {
            progress = JSON.parse(v.progress || "{}").progress || 0;
          } catch {}
          return (
            <article key={v.id}>
              <div>
                <strong>{v.title}</strong>
                <small>
                  {date(v.created_at)} ·{" "}
                  {v.state === "running"
                    ? `Rendu ${progress} %`
                    : v.state === "done"
                      ? bytes(v.size)
                      : v.error}
                </small>
              </div>
              <div className="heading-actions">
                {v.state === "done" && (
                  <a
                    className="button secondary"
                    href={`/api/motion/exports/${v.id}/file?download=1`}
                  >
                    <Download size={16} />
                    MP4
                  </a>
                )}
                {canEdit && v.state === "removed" ? (
                  <Button
                    icon={RotateCcw}
                    variant="secondary"
                    onClick={() => action(v, "restore")}
                  >
                    Restaurer
                  </Button>
                ) : (
                  canEdit && (
                    <button
                      className="icon-button"
                      title={
                        v.state === "running"
                          ? "Annuler le rendu"
                          : "Retirer l’export"
                      }
                      onClick={() =>
                        action(v, v.state === "running" ? "cancel" : "delete")
                      }
                    >
                      {v.state === "running" ? (
                        <Square size={17} />
                      ) : (
                        <Trash2 size={17} />
                      )}
                    </button>
                  )
                )}
              </div>
            </article>
          );
        })}
    </section>
  );
}
