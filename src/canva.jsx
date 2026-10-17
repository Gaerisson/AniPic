import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  Unplug,
} from "lucide-react";
import { api, apiDownload, imageUrl } from "./api.js";
import { Button, Modal, Spinner } from "./ui.jsx";
import { canvaFormats, canvaPresets } from "../shared/canva-layout.mjs";

export function CanvaConnection({ animalId, notify, setup = false, onChange }) {
  const [status, setStatus] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("/canva/status")
      .then((s) => {
        setStatus(s);
        onChange?.(s);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/canva/connect", {
        method: "POST",
        body: { ...(animalId ? { animalId } : {}) },
      });
      window.location.assign(result.url);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      const result = await api("/canva/connection", { method: "DELETE" });
      notify(
        result.revoked
          ? "Compte Canva déconnecté."
          : "Accès local retiré. Révoquez aussi Anipic dans les applications connectées de Canva.",
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`canva-connection ${setup ? "panel" : ""}`}>
      <div className="canva-connection-heading">
        <span className="canva-wordmark">Canva</span>
        <span className={`tag ${status?.connected ? "sage" : ""}`}>
          {status
            ? status.connected
              ? "Mon compte connecté"
              : status.configured
                ? "Prêt à connecter"
                : "À configurer"
            : "Vérification…"}
        </span>
      </div>
      <p>
        {status?.connected
          ? "Vos créations sont enregistrées dans votre compte Canva et restent accessibles depuis cette fiche."
          : "Connectez votre compte pour y envoyer le pré-design et les photos sélectionnées."}
      </p>
      <div className="canva-connection-buttons">
        <Button
          type="button"
          variant="secondary"
          icon={status?.connected ? Unplug : Link2}
          disabled={
            busy || !status || (!status.connected && !status.configured)
          }
          onClick={status?.connected ? disconnect : connect}
        >
          {busy
            ? "Un instant…"
            : status?.connected
              ? "Déconnecter mon compte"
              : "Connecter mon compte Canva"}
        </Button>
        {setup && (
          <Button type="button" variant="quiet" onClick={refresh}>
            Vérifier la configuration
          </Button>
        )}
      </div>
      {!status?.configured && status && (
        <p className="fineprint">
          {setup
            ? "Renseignez les variables serveur ci-dessous puis redémarrez Anipic."
            : "L’administrateur doit activer le connecteur dans API & connexions. Vous pouvez déjà télécharger le PowerPoint ci-dessous."}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {setup && status && (
        <details className="canva-setup">
          <summary>Configurer le connecteur Canva</summary>
          <ol>
            <li>
              Créez une application dans le{" "}
              <a
                href="https://www.canva.com/developers/"
                target="_blank"
                rel="noopener noreferrer"
              >
                portail développeur Canva <ExternalLink size={13} />
              </a>
              , avec la surface « Outside Canva ».
            </li>
            <li>
              Activez uniquement <code>design:content:write</code> et{" "}
              <code>design:meta:read</code>.
            </li>
            <li>
              Déclarez cette URL de retour, strictement identique :
              <code className="canva-code">{status.redirectUri}</code>
            </li>
            <li>
              Dans .env ou les variables de la stack Portainer :
              <code className="canva-code">
                CANVA_CLIENT_ID
                <br />
                CANVA_CLIENT_SECRET
                <br />
                CANVA_TOKEN_KEY
                <br />
                CANVA_REDIRECT_URI
              </code>
              La clé de chiffrement doit être aléatoire, de 32 octets en base64.
              Guide détaillé : CANVA.md dans le projet.
            </li>
            <li>
              Redémarrez Anipic, puis connectez votre compte avec le bouton
              ci-dessus. Chaque membre connecte son propre compte.
            </li>
          </ol>
          {status.missing.length > 0 && (
            <p className="fineprint">
              À renseigner ou corriger : {status.missing.join(" · ")}
            </p>
          )}
          <p className="fineprint">
            Les secrets restent sur le serveur. Aucune photo n’est envoyée à la
            connexion : l’envoi se déclenche depuis une fiche animal. L’accès
            aux applications en développement dépend de la configuration et de
            la validation Canva.
          </p>
        </details>
      )}
    </section>
  );
}
function SlidePreview({ page }) {
  return (
    <div
      className="canva-slide"
      style={{
        aspectRatio: `${page.width} / ${page.height}`,
        background: page.background,
      }}
      aria-label={page.label}
    >
      {page.items.map((item, i) => {
        const style = {
          left: `${(item.x / page.width) * 100}%`,
          top: `${(item.y / page.height) * 100}%`,
          width: `${(item.width / page.width) * 100}%`,
          height: `${(item.height / page.height) * 100}%`,
        };
        return item.type === "photo" ? (
          <img
            key={i}
            src={imageUrl(item.photoId, 1280)}
            alt=""
            style={style}
          />
        ) : item.type === "rect" ? (
          <i key={i} style={{ ...style, background: item.color }} />
        ) : (
          <div
            key={i}
            style={{
              ...style,
              fontSize: `${(item.size / page.width) * 100}cqw`,
              color: item.color,
              fontWeight: item.bold ? 700 : 400,
              textAlign: item.align,
              lineHeight: 1.14,
              whiteSpace: "pre-line",
            }}
          >
            {item.value}
          </div>
        );
      })}
    </div>
  );
}
export function CanvaDialog({ animalId, photoId, close, open, notify }) {
  const [animal, setAnimal] = useState(null),
    [selected, setSelected] = useState([]),
    [options, setOptions] = useState({
      format: "story",
      preset: "editorial",
      accent: "#b45a33",
      closing: "Une rencontre commence ici.",
      includeDescription: true,
      includeCompatibility: true,
    }),
    [plan, setPlan] = useState(null),
    [page, setPage] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [connection, setConnection] = useState(null),
    [projects, setProjects] = useState([]),
    [active, setActive] = useState(null),
    [pollError, setPollError] = useState("");
  const sending = useRef(false),
    designWindow = useRef(null),
    autoProject = useRef(null);
  function openReady(project) {
    if (project.id !== autoProject.current) return;
    if (project.state === "success" && project.designs?.[0]) {
      if (designWindow.current && !designWindow.current.closed)
        designWindow.current.location.replace(
          `/api/canva/projects/${project.id}/edit/${encodeURIComponent(project.designs[0].id)}`,
        );
      else
        notify(
          "Design prêt. Cliquez sur « Ouvrir dans Canva » (fenêtre bloquée par le navigateur).",
        );
      autoProject.current = null;
    } else if (["failed", "interrupted"].includes(project.state)) {
      designWindow.current?.close();
      autoProject.current = null;
    }
  }
  const history = () =>
    api(`/canva/projects?animalId=${animalId}`).then((r) =>
      setProjects(r.items),
    );
  useEffect(() => {
    let alive = true;
    api(`/animals/${animalId}`)
      .then((a) => {
        if (!alive) return;
        setAnimal(a);
        let draft;
        try {
          draft = JSON.parse(
            sessionStorage.getItem("anipic-canva-draft") || "null",
          );
        } catch {}
        if (draft?.animalId === animalId) {
          const ids = draft.photoIds
            ?.filter((id) => a.photos.some((p) => p.id === id))
            .slice(0, 8);
          if (ids?.length) {
            setSelected(ids);
            setOptions((o) => ({ ...o, ...draft.options }));
          } else
            setSelected(
              a.photos
                .filter((p) => !p.archived_at && !p.hidden)
                .slice(0, 3)
                .map((p) => p.id),
            );
        } else {
          const first =
            a.photos.find((p) => p.id === photoId) ||
            a.photos.find((p) => !p.hidden && !p.archived_at);
          setSelected(
            first
              ? [
                  first.id,
                  ...a.photos
                    .filter(
                      (p) => p.id !== first.id && !p.hidden && !p.archived_at,
                    )
                    .slice(0, 2)
                    .map((p) => p.id),
                ]
              : [],
          );
          if (a.status !== "available")
            setOptions((o) => ({
              ...o,
              closing:
                a.status === "adopted"
                  ? "Une nouvelle histoire commence."
                  : "À la rencontre d’un compagnon.",
            }));
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    history().catch((e) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [animalId]);
  useEffect(() => {
    if (!animal) return;
    try {
      sessionStorage.setItem(
        "anipic-canva-draft",
        JSON.stringify({ animalId, photoIds: selected, options }),
      );
    } catch {}
    let alive = true;
    if (!selected.length || !options.closing.trim()) {
      setPlan(null);
      return;
    }
    const timer = setTimeout(
      () =>
        api("/canva/plan", {
          method: "POST",
          body: { animalId, photoIds: selected, ...options },
        })
          .then((p) => {
            if (alive) {
              setPlan(p);
              setPage((v) => Math.min(v, p.pages.length - 1));
              setError("");
            }
          })
          .catch((e) => {
            if (alive) setError(e.message);
          }),
      180,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [selected, options, animal]);
  useEffect(() => {
    if (!active || active.state !== "in_progress") return;
    let alive = true,
      timer,
      attempts = 0;
    async function poll() {
      try {
        const p = await api(`/canva/projects/${active.id}`);
        if (!alive) return;
        setProjects((rows) => [p, ...rows.filter((r) => r.id !== p.id)]);
        setActive(p);
        openReady(p);
        setPollError("");
        if (p.state === "in_progress" && ++attempts < 40)
          timer = setTimeout(poll, 3000);
        else if (p.state === "in_progress")
          setPollError(
            "Canva prépare encore le fichier. Utilisez « Vérifier l’import » dans quelques instants.",
          );
      } catch (e) {
        if (alive) setPollError(e.message);
      }
    }
    timer = setTimeout(poll, 3000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [active?.id, active?.state]);
  async function exportTo(destination) {
    if (sending.current) return;
    sending.current = true;
    setBusy(destination);
    setError("");
    if (destination === "canva") {
      designWindow.current = window.open("about:blank", "_blank");
      if (designWindow.current) {
        designWindow.current.opener = null;
        designWindow.current.document.title = "AniPic · Préparation Canva";
        designWindow.current.document.body.textContent =
          "Votre design Canva est en préparation. Cette fenêtre l’ouvrira dès qu’il sera prêt.";
      }
    }
    try {
      const body = { animalId, photoIds: selected, ...options };
      if (destination === "pptx") {
        await apiDownload(
          "/canva/presentation",
          body,
          `${animal.name}-${options.format}.pptx`,
        );
        notify(
          "Pré-design PowerPoint téléchargé. Importez-le dans Canva pour l’éditer.",
        );
      } else {
        const project = await api("/canva/projects", { method: "POST", body });
        autoProject.current = project.id;
        openReady(project);
        setActive(project);
        await history();
      }
    } catch (e) {
      if (destination === "canva") designWindow.current?.close();
      setError(e.message);
      history().catch(() => {});
    } finally {
      setBusy("");
      sending.current = false;
    }
  }
  async function checkProject(project) {
    setBusy(project.id);
    setPollError("");
    try {
      const p = await api(`/canva/projects/${project.id}`);
      setActive(p);
      openReady(p);
      await history();
    } catch (e) {
      setPollError(e.message);
    } finally {
      setBusy("");
    }
  }
  const change = (key, value) => setOptions((o) => ({ ...o, [key]: value }));
  return (
    <Modal
      title={animal ? `Créer dans Canva · ${animal.name}` : "Créer dans Canva"}
      wide
      className="canva-modal"
      onClose={close}
    >
      {!animal ? (
        error ? (
          <p role="alert" className="error-text">
            {error}
          </p>
        ) : (
          <Spinner />
        )
      ) : (
        <>
          <div className="canva-body">
            <div className="canva-intro">
              <span className="canva-wordmark">Canva</span>
              <div>
                <strong>Préparer une création Canva</strong>
                <p>
                  Un pré-design avec des photos et des textes éditables, puis
                  vos animations, votre musique et votre montage dans Canva.
                </p>
              </div>
            </div>
            <div className="canva-workspace">
              <div className="canva-preview-column">
                <div
                  className={`canva-preview-stage ${options.format}`}
                  aria-busy={!!busy}
                >
                  {plan && selected.length ? (
                    <SlidePreview
                      page={plan.pages[Math.min(page, plan.pages.length - 1)]}
                    />
                  ) : (
                    <p>Sélectionnez au moins une photo.</p>
                  )}
                </div>
                {plan && (
                  <>
                    <div className="canva-pagination">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Page précédente du pré-design"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span>
                        {page + 1} / {plan.pages.length} ·{" "}
                        {plan.pages[page]?.label}
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Page suivante du pré-design"
                        disabled={page >= plan.pages.length - 1}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <div className="canva-pages">
                      {plan.pages.map((p, i) => (
                        <button
                          type="button"
                          key={i}
                          aria-label={`Aperçu page ${i + 1} : ${p.label}`}
                          aria-pressed={i === page}
                          onClick={() => setPage(i)}
                        >
                          <SlidePreview page={p} />
                          <span>{i + 1}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="fineprint">
                  Aperçu indicatif. Canva peut ajuster les polices et les
                  recadrages à l’import. Aucun logo Anipic ajouté.
                </p>
              </div>
              <div className="canva-controls">
                <div className="canva-fields">
                  <label>
                    Format
                    <select
                      value={options.format}
                      disabled={!!busy}
                      onChange={(e) => change("format", e.target.value)}
                    >
                      {Object.entries(canvaFormats).map(([key, f]) => (
                        <option key={key} value={key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pré-design
                    <select
                      value={options.preset}
                      disabled={!!busy}
                      onChange={(e) =>
                        setOptions((o) => ({
                          ...o,
                          preset: e.target.value,
                          accent: canvaPresets[e.target.value].accent,
                        }))
                      }
                    >
                      {Object.entries(canvaPresets).map(([key, p]) => (
                        <option key={key} value={key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="canva-fields canva-accent">
                  <label>
                    Couleur d’accent
                    <input
                      type="color"
                      value={options.accent}
                      disabled={!!busy}
                      onChange={(e) => change("accent", e.target.value)}
                    />
                  </label>
                  <label>
                    Phrase finale
                    <input
                      value={options.closing}
                      maxLength={65}
                      disabled={!!busy}
                      onChange={(e) => change("closing", e.target.value)}
                    />
                  </label>
                </div>
                <div className="canva-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={options.includeDescription}
                      disabled={!!busy}
                      onChange={(e) =>
                        change("includeDescription", e.target.checked)
                      }
                    />
                    Description SPA
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={options.includeCompatibility}
                      disabled={!!busy}
                      onChange={(e) =>
                        change("includeCompatibility", e.target.checked)
                      }
                    />
                    Ententes connues
                  </label>
                </div>
                <div className="canva-photo-heading">
                  <strong>Vos photos</strong>
                  <span>
                    {selected.length} / 8 · la n° 1 sert de couverture
                  </span>
                </div>
                <div className="canva-photo-picker">
                  {animal.photos.length ? (
                    animal.photos.map((p) => (
                      <div
                        key={p.id}
                        className={selected.includes(p.id) ? "selected" : ""}
                      >
                        <button
                          type="button"
                          disabled={
                            !!busy ||
                            (!selected.includes(p.id) && selected.length >= 8)
                          }
                          aria-pressed={selected.includes(p.id)}
                          aria-label={`${selected.includes(p.id) ? "Retirer" : "Sélectionner"} ${p.filename}${p.hidden ? " (privée)" : ""}`}
                          onClick={() =>
                            setSelected((s) =>
                              s.includes(p.id)
                                ? s.filter((v) => v !== p.id)
                                : [...s, p.id],
                            )
                          }
                        >
                          <img src={imageUrl(p.id, 320)} alt={p.filename} />
                          {selected.includes(p.id) && (
                            <b>{selected.indexOf(p.id) + 1}</b>
                          )}
                          {p.hidden ? (
                            <small>Privée</small>
                          ) : p.archived_at ? (
                            <small>Archive</small>
                          ) : null}
                        </button>
                        {selected.indexOf(p.id) > 0 && (
                          <button
                            type="button"
                            className="canva-cover-button"
                            disabled={!!busy}
                            onClick={() =>
                              setSelected((s) => [
                                p.id,
                                ...s.filter((v) => v !== p.id),
                              ])
                            }
                          >
                            Couverture
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>
                      Aucune photo locale.{" "}
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => open({ type: "upload", id: animal.id })}
                      >
                        Ajouter des photos
                      </button>
                    </p>
                  )}
                </div>
                <CanvaConnection
                  animalId={animalId}
                  notify={notify}
                  onChange={setConnection}
                />
                <p className="fineprint">
                  L’envoi transmet à Canva uniquement les photos sélectionnées
                  en JPEG sans EXIF, et les informations affichées. Les photos
                  privées sélectionnées seront aussi transmises. Les originaux
                  restent dans Anipic.
                </p>
              </div>
            </div>
            {projects.length > 0 && (
              <section className="canva-history">
                <h3>Mes créations pour {animal.name}</h3>
                {projects.map((p) => (
                  <div key={p.id} className="canva-project">
                    <div>
                      <strong>{p.title}</strong>
                      <small>
                        {p.photoCount} photo{p.photoCount > 1 ? "s" : ""} ·{" "}
                        {new Date(p.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                        {
                          {
                            success: "Prêt à éditer",
                            in_progress: "Import Canva en cours",
                            sending: "Envoi en cours",
                            failed: "Import refusé",
                            interrupted: "Envoi à vérifier",
                          }[p.state]
                        }
                      </small>
                      {p.error && <p className="error-text">{p.error}</p>}
                    </div>
                    <div className="canva-project-actions">
                      {p.state === "in_progress" && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() => checkProject(p)}
                        >
                          Vérifier l’import
                        </Button>
                      )}
                      {p.designs.map((d) => (
                        <a
                          key={d.id}
                          className="button secondary"
                          href={`/api/canva/projects/${p.id}/edit/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ouvrir dans Canva <ExternalLink size={16} />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
                {pollError && (
                  <p role="alert" className="error-text">
                    {pollError}
                  </p>
                )}
                <p className="fineprint">
                  Ces liens ouvrent votre compte Canva. Les modifications faites
                  dans Canva ne remplacent pas les photos ni les informations
                  SPA dans Anipic.
                </p>
              </section>
            )}
          </div>
          <div className="canva-export-dock">
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <div className="canva-export-actions">
              <Button
                type="button"
                icon={busy === "canva" ? LoaderCircle : ArrowUpRight}
                disabled={
                  !!busy ||
                  !selected.length ||
                  !options.closing.trim() ||
                  !connection?.connected ||
                  !connection?.configured ||
                  active?.state === "in_progress"
                }
                onClick={() => exportTo("canva")}
              >
                {busy === "canva"
                  ? "Envoi à Canva…"
                  : "Envoyer le pré-design à Canva"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={Download}
                disabled={!!busy || !selected.length || !options.closing.trim()}
                onClick={() => exportTo("pptx")}
              >
                {busy === "pptx" ? "Préparation…" : "Télécharger le PowerPoint"}
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
