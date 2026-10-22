import { useEffect, useState, useRef } from "react";
import {
  Printer,
  Image,
  LoaderCircle,
  CheckCheck,
  Eye,
  Camera,
  Globe,
} from "lucide-react";
import { api, apiBlob, apiDownload, imageUrl, speciesName } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
const templates = [
  [
    "logo-mosaic",
    "Les regards dans le logo",
    "Silhouette SPA en portraits, chaque nom reste lisible",
  ],
  ["spa", "Mosaïque SPA", "Clair, orange et portraits aux bords découpés"],
  ["glass", "Verre moderne", "Cartes translucides, reflets et fond lumineux"],
  ["editorial", "Éditorial", "Contraste profond et grille photographique"],
  [
    "polaroid",
    "Instants du refuge",
    "Papier chaleureux et tirages légèrement inclinés",
  ],
];
export default function GroupPoster({ user, overview, notify }) {
  const [animals, setAnimals] = useState(null),
    [selected, setSelected] = useState([]),
    [sources, setSources] = useState({}),
    [species, setSpecies] = useState("all"),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [generated, setGenerated] = useState("");
  const [options, setOptions] = useState({
    template: "spa",
    format: "A3",
    title: overview?.refugeName || "Les regards du refuge",
    subtitle: "Ils attendent leur famille. Et si c’était vous ?",
    footer: "Venez les rencontrer au refuge",
    accent: overview?.interface?.accentColor || "#ee7029",
    names: true,
    columns: 0,
    qrUrl: "",
  });
  const latest = useRef();
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      let rows = [];
      for (let page = 1; page <= 60; page++) {
        const d = await api(`/animals?limit=60&sort=name&page=${page}`);
        rows.push(...d.items);
        if (page >= d.pages) break;
      }
      if (active)
        setAnimals(
          rows.filter((a) => a.public_cover_id || a.source_metadata?.thumbnail),
        );
    })().catch((e) => notify(e.message, "error"));
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(
    () => () => {
      if (latest.current) URL.revokeObjectURL(latest.current);
    },
    [],
  );
  if (false)
    return (
      <Empty
        title="Grande affiche du refuge"
        text="Connectez-vous avec un compte de l’équipe pour préparer une affiche."
      />
    );
  const list = (animals || []).filter(
    (a) =>
      (species === "all" || a.species === species) &&
      `${a.name} ${a.source_id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const payload = {
      ...options,
      animals: selected.map((id) => ({ id, source: sources[id] || "auto" })),
    },
    signature = JSON.stringify(payload),
    dirty = !!preview && signature !== generated;
  const change = (key, value) => setOptions((v) => ({ ...v, [key]: value }));
  const render = async (output) => {
    setBusy(true);
    try {
      if (output === "preview") {
        const blob = await apiBlob("/group-posters", { ...payload, output }),
          url = URL.createObjectURL(blob);
        if (latest.current) URL.revokeObjectURL(latest.current);
        latest.current = url;
        setPreview(url);
        setGenerated(signature);
      } else {
        await apiDownload(
          "/group-posters",
          { ...payload, output },
          `affiche-refuge-${options.template}-${options.format}.${output}`,
        );
        notify("Affiche prête.");
      }
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LES VISAGES DU REFUGE</div>
          <h1>Une affiche, tous ces regards</h1>
          <p>
            Composez une grande affiche avec les photos locales ou celles du
            site SPA.
          </p>
        </div>
      </div>
      <div className="group-poster-layout">
        <section className="panel group-poster-controls">
          <h2>Votre composition</h2>
          <fieldset disabled={busy}>
            <div className="group-template-grid">
              {templates.map(([id, title, note]) => (
                <button
                  key={id}
                  className={`template-tile tile-${id} ${options.template === id ? "selected" : ""}`}
                  aria-pressed={options.template === id}
                  onClick={() =>
                    setOptions((v) => ({
                      ...v,
                      template: id,
                      ...(id === "logo-mosaic"
                        ? { names: true, columns: 0 }
                        : {}),
                    }))
                  }
                >
                  <span className="template-mini">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </button>
              ))}
            </div>
            <div className="form-stack">
              <label>
                Titre
                <input
                  value={options.title}
                  maxLength={90}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              <label>
                Sous-titre
                <textarea
                  rows={2}
                  value={options.subtitle}
                  maxLength={180}
                  onChange={(e) => change("subtitle", e.target.value)}
                />
              </label>
              <label>
                Bas de l’affiche
                <textarea
                  rows={2}
                  value={options.footer}
                  maxLength={180}
                  onChange={(e) => change("footer", e.target.value)}
                />
              </label>
              <div className="form-row">
                <label>
                  Format
                  <select
                    value={options.format}
                    onChange={(e) => change("format", e.target.value)}
                  >
                    {["A4", "A3", "A2"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Accent
                  <input
                    type="color"
                    value={options.accent}
                    onChange={(e) => change("accent", e.target.value)}
                  />
                </label>
                <label>
                  Colonnes
                  <select
                    disabled={options.template === "logo-mosaic"}
                    value={options.columns}
                    onChange={(e) => change("columns", Number(e.target.value))}
                  >
                    <option value={0}>Automatique</option>
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  disabled={options.template === "logo-mosaic"}
                  checked={options.names}
                  onChange={(e) => change("names", e.target.checked)}
                />
                Afficher les noms
              </label>
              {options.template === "logo-mosaic" && (
                <p className="fineprint">
                  Les portraits composent la silhouette du logo. La disposition
                  s’adapte à la sélection et les noms restent toujours affichés.
                </p>
              )}
              <label>
                Adresse du QR code (facultatif)
                <input
                  type="url"
                  maxLength={500}
                  placeholder="https://…"
                  value={options.qrUrl}
                  onChange={(e) => change("qrUrl", e.target.value)}
                />
              </label>
            </div>
          </fieldset>
        </section>
        <section className="group-poster-preview panel">
          <div className="panel-heading">
            <h2>Aperçu</h2>
            <span>{selected.length}/60 portraits</span>
          </div>
          <div className="group-preview-stage">
            {preview ? (
              <img
                src={preview}
                alt={`Grande affiche du refuge · ${options.template}`}
              />
            ) : (
              <div className="group-preview-empty">
                <Image size={46} />
                <p>Sélectionnez vos animaux et créez un aperçu.</p>
              </div>
            )}
            {busy && (
              <div className="group-preview-loading" role="status">
                <LoaderCircle size={27} className="spin" />
                <strong>Préparation des portraits…</strong>
                <span>
                  Les photos SPA sont récupérées avant la composition.
                </span>
              </div>
            )}
          </div>
          {dirty && (
            <p className="small-note">
              La composition a changé. Actualisez l’aperçu pour voir les
              modifications.
            </p>
          )}
          <div className="heading-actions">
            <Button
              icon={busy ? LoaderCircle : Eye}
              disabled={busy || !selected.length || !options.title.trim()}
              onClick={() => render("preview")}
            >
              {preview ? "Actualiser l’aperçu" : "Créer l’aperçu"}
            </Button>
            <Button
              variant="secondary"
              icon={Printer}
              disabled={busy || !selected.length || !options.title.trim()}
              onClick={() => render("pdf")}
            >
              PDF impression
            </Button>
            <Button
              variant="quiet"
              icon={Image}
              disabled={busy || !selected.length || !options.title.trim()}
              onClick={() => render("png")}
            >
              PNG haute définition
            </Button>
          </div>
          <p className="fineprint">
            Document A4 / A3 / A2 : 300 dpi · Les photos privées sont exclues.
          </p>
        </section>
      </div>
      <section className="panel group-poster-picker">
        <div className="panel-heading">
          <h2>Choisir les portraits</h2>
          <span>{selected.length} sélectionnés</span>
        </div>
        <div className="group-picker-toolbar">
          <label>
            Recherche
            <input
              placeholder="Nom ou identifiant SPA…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Espèce
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            >
              <option value="all">Toutes</option>
              {Object.entries(speciesName).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            icon={CheckCheck}
            disabled={busy || !animals}
            onClick={() =>
              setSelected(
                list.length > 0 && list.every((a) => selected.includes(a.id))
                  ? selected.filter((id) => !list.some((a) => a.id === id))
                  : [...new Set([...selected, ...list.map((a) => a.id)])].slice(
                      0,
                      60,
                    ),
              )
            }
          >
            Sélectionner les résultats · 60 max
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => setSelected([])}
          >
            Tout désélectionner
          </Button>
        </div>
        {!animals ? (
          <Spinner />
        ) : (
          <div className="group-animal-grid">
            {list.map((a) => {
              const local = a.public_cover_id && sources[a.id] !== "spa";
              return (
                <article
                  key={a.id}
                  className={selected.includes(a.id) ? "selected" : ""}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      disabled={
                        busy ||
                        (!selected.includes(a.id) && selected.length >= 60)
                      }
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, a.id]
                            : v.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <span>
                      {local ? (
                        <img src={imageUrl(a.public_cover_id, 320)} alt="" />
                      ) : (
                        <SpaPhoto animal={a} compact />
                      )}
                    </span>
                    <strong>
                      {a.name}
                      <small>{speciesName[a.species]}</small>
                    </strong>
                  </label>
                  <select
                    aria-label={"Photo de " + a.name}
                    value={sources[a.id] || "auto"}
                    disabled={busy}
                    onChange={(e) =>
                      setSources((v) => ({ ...v, [a.id]: e.target.value }))
                    }
                  >
                    <option value="auto">
                      {a.public_cover_id ? "Photo locale" : "Photo du site SPA"}
                    </option>
                    {a.public_cover_id && a.source_metadata?.thumbnail && (
                      <option value="spa">Photo du site SPA</option>
                    )}
                  </select>
                  <small className="photo-origin-note">
                    {local ? <Camera size={12} /> : <Globe size={12} />}
                    {local ? "Locale" : "Site SPA"}
                  </small>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
