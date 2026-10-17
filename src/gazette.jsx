import { useState, useEffect, useMemo } from "react";
import {
  Newspaper,
  CalendarDays,
  Heart,
  Plus,
  Minus,
  Download,
  Save,
  Trash2,
  Copy,
  Camera,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { api, uid, copyText } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { Progress, useJob, WorkshopAnimalSearch } from "./workshop-common.jsx";
import {
  gazetteDefaults,
  mergeGazetteMovements,
  movementKey,
  canonicalGazette,
  gazettePortraits,
  gazetteSummary,
  gazetteSourceRevision,
} from "../shared/gazette-content.mjs";
import { gazetteAgenda, agendaDateLabel } from "../shared/agenda.mjs";
import {
  gazetteFileDescriptor,
  prepareGazetteFile,
  canShareGazette,
  shareGazette,
} from "./gazette-sharing.js";
import "./gazette.css";
const monthLabel = (m) =>
  new Date(m + "-15T12:00:00Z").toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const categories = {
  open_day: "Portes ouvertes",
  collection: "Collecte solidaire",
  event: "Événement",
  appointment: "Rendez-vous",
  other: "À noter",
};
function initialEditor(user) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`anipic-gazette-editor-${user.id}`) || "null",
    );
    if (
      /^20\d{2}-(0[1-9]|1[0-2])$/.test(saved?.options?.month || "") &&
      Array.isArray(saved.options.animals)
    )
      return {
        options: { ...gazetteDefaults(saved.options.month), ...saved.options },
        draftId: saved.draftId || uid(),
        monthEdits: saved.monthEdits || {},
      };
  } catch {}
  return { options: gazetteDefaults(), draftId: uid() };
}
function Thumb({ src, name }) {
  const [state, setState] = useState(src ? "loading" : "missing");
  useEffect(() => setState(src ? "loading" : "missing"), [src]);
  return (
    <span className="gazette-thumb">
      {src && state !== "missing" && (
        <img
          src={src}
          alt={name || ""}
          onLoad={() => setState("ready")}
          onError={() => setState("missing")}
        />
      )}{" "}
      {state === "loading" && <LoaderCircle className="spin" size={20} />}{" "}
      {state === "missing" && <Camera size={24} />}
    </span>
  );
}
function Exports({ job, dirty, notify }) {
  const [page, setPage] = useState(0),
    [format, setFormat] = useState("social"),
    [file, setFile] = useState(null),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(""),
    [sharing, setSharing] = useState(false);
  useEffect(() => {
    setPage(0);
  }, [job?.id]);
  const descriptor =
    job?.state === "done" ? gazetteFileDescriptor(job, format, page) : null;
  useEffect(() => {
    let stop = false;
    setFile(null);
    setError("");
    if (!descriptor || dirty) return;
    setPreparing(true);
    prepareGazetteFile(descriptor)
      .then((f) => {
        if (!stop) setFile(f);
      })
      .catch((e) => {
        if (!stop) setError(e.message);
      })
      .finally(() => {
        if (!stop) setPreparing(false);
      });
    return () => {
      stop = true;
    };
  }, [descriptor?.url, dirty]);
  if (!job)
    return (
      <div className="gazette-preview-empty">
        <Newspaper size={46} />
        <h3>Votre prochaine édition</h3>
        <p>
          Les animaux et le résumé se préparent automatiquement. Lancez la
          génération pour découvrir votre gazette.
        </p>
      </div>
    );
  if (job.state !== "done") return <Progress job={job} />;
  const supported = canShareGazette(file);
  return (
    <div className="form-stack gazette-exports">
      <div>
        <span className="eyebrow">ÉDITION GÉNÉRÉE</span>
        <h3>{job.result.title}</h3>
        <p>
          {monthLabel(job.result.month)} · {job.result.pages} page(s)
        </p>
      </div>
      {dirty && (
        <p className="gazette-notice" role="status">
          Des modifications sont en attente. Préparez à nouveau la gazette pour
          exporter cette version.
        </p>
      )}
      <div className="gazette-page-controls">
        <Button
          variant="secondary"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          ←
        </Button>
        <span>
          Page {page + 1} / {job.result.pages}
        </span>
        <Button
          variant="secondary"
          disabled={page + 1 >= job.result.pages}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </Button>
      </div>
      <img
        className="work-gazette-preview"
        src={`/api/creative/gazette/${job.id}/page/${page}`}
        alt={`Gazette, page ${page + 1}`}
      />
      {!dirty && (
        <>
          <div className="gazette-downloads">
            <a
              className="button"
              href={`/api/creative/gazette/${job.id}/file`}
              download
            >
              <Download size={17} />
              PDF complet
            </a>
            <a
              className="button secondary"
              href={`/api/creative/gazette/${job.id}/social`}
              download
            >
              <Download size={17} />
              Visuel réseaux
            </a>
            <a
              className="button secondary"
              href={`/api/creative/gazette/${job.id}/images`}
              download
            >
              <Download size={17} />
              Toutes les images · ZIP
            </a>
          </div>
          <section className="gazette-share">
            <h4>
              <MessageCircle size={19} />
              Partager dans WhatsApp
            </h4>
            <label>
              Fichier à partager
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="social">Visuel réseaux · PNG 1080 × 1350</option>
                <option value="pdf">Gazette complète · PDF</option>
                <option value="page">Page {page + 1} · JPEG</option>
              </select>
            </label>
            {preparing && (
              <p className="gazette-inline-status" role="status">
                <LoaderCircle className="spin" size={16} />
                Préparation du fichier de partage…
              </p>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {supported ? (
              <>
                <Button
                  icon={MessageCircle}
                  disabled={!file || sharing}
                  onClick={() => {
                    setSharing(true);
                    try {
                      shareGazette(file, job.result.caption || job.result.title)
                        .catch((e) => {
                          if (e.name !== "AbortError")
                            notify(e.message, "error");
                        })
                        .finally(() => setSharing(false));
                    } catch (e) {
                      setSharing(false);
                      notify(e.message, "error");
                    }
                  }}
                >
                  {sharing ? "Partage ouvert…" : "Partager le fichier…"}
                </Button>
                <small>
                  Choisissez WhatsApp, puis votre conversation ou votre groupe
                  dans la fenêtre de partage.
                </small>
              </>
            ) : (
              <>
                <a
                  className="button secondary"
                  href={descriptor.url}
                  download={descriptor.name}
                >
                  <Download size={16} />
                  Télécharger pour WhatsApp
                </a>
                <a
                  className="button secondary"
                  href={`https://wa.me/?text=${encodeURIComponent(job.result.caption || job.result.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={16} />
                  Ouvrir WhatsApp
                </a>
                <small>
                  Si ce navigateur ne propose pas le partage de fichiers,
                  téléchargez le document puis joignez-le dans WhatsApp.
                </small>
              </>
            )}
            <button
              className="text-link"
              onClick={() =>
                copyText(job.result.caption || job.result.title)
                  .then(() => notify("Texte d’accompagnement copié."))
                  .catch((e) => notify(e.message, "error"))
              }
            >
              <Copy size={14} />
              Copier le texte d’accompagnement
            </button>
          </section>
        </>
      )}
      {job.errors?.length > 0 && (
        <details className="gazette-notice">
          <summary>{job.errors.length} portrait(s) indisponible(s)</summary>
          <p>
            Ces mouvements apparaissent avec leur nom et leur date, sans
            portrait.
          </p>
          {job.errors.map((e, i) => (
            <small key={i}>{e.name}</small>
          ))}
        </details>
      )}
    </div>
  );
}
export default function Gazette({ user, notify }) {
  const [initial] = useState(() => initialEditor(user)),
    [options, setOptions] = useState(initial.options),
    [draftId, setDraftId] = useState(initial.draftId),
    [monthEdits, setMonthEdits] = useState(initial.monthEdits || {}),
    [drafts, setDrafts] = useState([]),
    [metadata, setMetadata] = useState({}),
    [snapshot, setSnapshot] = useState(null),
    [tab, setTab] = useState("overview"),
    [refresh, setRefresh] = useState(0),
    [snapshotError, setSnapshotError] = useState(""),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [job, start] = useJob(user, "gazette", notify),
    [adding, setAdding] = useState(null),
    [addKind, setAddKind] = useState("arrival"),
    [addDate, setAddDate] = useState(""),
    [formError, setFormError] = useState("");
  const patch = (name, value) => setOptions((o) => ({ ...o, [name]: value }));
  useEffect(() => {
    try {
      localStorage.setItem(
        `anipic-gazette-editor-${user.id}`,
        JSON.stringify({ options, draftId, monthEdits }),
      );
    } catch {}
  }, [options, draftId, monthEdits, user.id]);
  const loadDrafts = () =>
    api("/creative/gazette/drafts")
      .then(setDrafts)
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    loadDrafts();
  }, []);
  useEffect(() => {
    const update = () => setRefresh((n) => n + 1);
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    let stop = false;
    api(`/creative/gazette/month?month=${options.month}`)
      .then((d) => {
        if (!stop) {
          setSnapshot(d);
          setSnapshotError("");
          setMetadata((v) => ({
            ...v,
            ...Object.fromEntries(
              [
                ...d.added,
                ...d.arrivals,
                ...d.adopted,
                ...(d.candidates || []),
              ].map((a) => [a.animalId, a]),
            ),
          }));
        }
      })
      .catch((e) => {
        if (!stop) setSnapshotError(e.message);
      });
    return () => {
      stop = true;
    };
  }, [options.month, refresh]);
  const selectedIds = [
    ...new Set([
      ...options.animals.map((a) => a.id),
      ...options.movements.map((a) => a.animalId),
    ]),
  ]
    .sort()
    .join(",");
  useEffect(() => {
    let stop = false;
    const run = async () => {
      const ids = selectedIds ? selectedIds.split(",") : [];
      for (let i = 0; i < ids.length; i += 60) {
        const d = await api(
          `/creative/gazette/catalogue?ids=${ids.slice(i, i + 60).join(",")}`,
        );
        if (stop) return;
        setMetadata((v) => ({
          ...v,
          ...Object.fromEntries(d.items.map((a) => [a.animalId, a])),
        }));
      }
    };
    run().catch((e) => {
      if (!stop) notify(e.message, "error");
    });
    return () => {
      stop = true;
    };
  }, [selectedIds]);
  const movements = useMemo(
    () =>
      mergeGazetteMovements(options, snapshot || {}).map((m) => ({
        ...m,
        name: metadata[m.animalId]?.name || m.name,
      })),
    [options, snapshot, metadata],
  );
  const allRows = useMemo(
    () =>
      mergeGazetteMovements(
        { ...options, excludedMovements: [] },
        snapshot || {},
      ),
    [options, snapshot],
  );
  const currentSnapshot = snapshot?.month === options.month ? snapshot : null;
  const portraits = gazettePortraits(options, currentSnapshot || {}, movements);
  const dates = gazetteAgenda(options, currentSnapshot?.agenda || []);
  const summary = options.autoSummary
    ? gazetteSummary(options, currentSnapshot || {}, movements, dates)
    : options.introduction;
  const summaryMode = (enabled) =>
    setOptions((o) => ({
      ...o,
      autoSummary: enabled,
      introduction: enabled ? o.introduction : summary,
    }));
  const dirty =
    job?.state === "done" &&
    (JSON.stringify(
      canonicalGazette({ ...gazetteDefaults(options.month), ...options }),
    ) !== JSON.stringify(canonicalGazette(job.result.config)) ||
      (!!currentSnapshot &&
        !!job.result.sourceRevision &&
        gazetteSourceRevision(currentSnapshot) !== job.result.sourceRevision));
  const busyGenerating = job?.state === "running";
  const endOfMonth = new Date(
    Date.UTC(+options.month.slice(0, 4), +options.month.slice(5), 0),
  )
    .toISOString()
    .slice(0, 10);
  const changeMovement = (row, changes) =>
    setOptions((o) => {
      const replacement = {
        animalId: row.animalId,
        kind: row.kind,
        date: row.date,
        source: row.source || "auto",
        note: row.note || "",
        ...changes,
      };
      return {
        ...o,
        movements: [
          ...o.movements.filter((m) => movementKey(m) !== movementKey(row)),
          replacement,
        ],
      };
    });
  const exclude = (row) =>
    patch(
      "excludedMovements",
      options.excludedMovements.includes(movementKey(row))
        ? options.excludedMovements.filter((k) => k !== movementKey(row))
        : [...options.excludedMovements, movementKey(row)],
    );
  const save = async () => {
    setBusy(true);
    setFormError("");
    try {
      await api(`/creative/gazette/drafts/${draftId}`, {
        method: "PUT",
        body: options,
      });
      notify("Édition enregistrée dans les brouillons de l’équipe.");
      await loadDrafts();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const generate = async () => {
    setBusy(true);
    setFormError("");
    try {
      start(await api("/creative/gazette", { method: "POST", body: options }));
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const sourceLabel = (row) =>
    row.origin === "manual"
      ? "Saisie pour cette édition"
      : row.kind === "arrival"
        ? "Date d’arrivée SPA"
        : "Changement de statut enregistré";
  // Update the date override and exclusion together; both belong only to this edition.
  const addMovement = () => {
    if (!adding || !addDate) return;
    setOptions((o) => ({
      ...o,
      movements: [
        ...o.movements.filter(
          (m) => movementKey(m) !== `${addKind}:${adding.id}`,
        ),
        {
          animalId: adding.id,
          kind: addKind,
          date: addDate,
          source: "auto",
          note: "",
        },
      ],
      excludedMovements: o.excludedMovements.filter(
        (k) => k !== `${addKind}:${adding.id}`,
      ),
    }));
    setMetadata((v) => ({ ...v, [adding.id]: adding }));
    setAdding(null);
    setAddDate("");
  };
  return (
    <div className="gazette-editor form-stack">
      <div className="gazette-intro">
        <div>
          <span className="eyebrow">LA VIE DU REFUGE, MOIS APRÈS MOIS</span>
          <h3>Le refuge raconte son mois.</h3>
          <p>
            Les arrivées, les adoptions, les portraits et l’agenda se réunissent
            automatiquement. Ajoutez simplement le mot de l’équipe si vous le
            souhaitez.
          </p>
        </div>
        <Newspaper size={38} />
      </div>
      <div className="gazette-toolbar">
        <label>
          Reprendre une édition
          <select
            value={drafts.some((d) => d.id === draftId) ? draftId : ""}
            onChange={(e) => {
              const d = drafts.find((d) => d.id === e.target.value);
              if (d) {
                setOptions({ ...gazetteDefaults(d.config.month), ...d.config });
                setMonthEdits({});
                setDraftId(d.id);
                setMetadata((v) => ({
                  ...v,
                  ...Object.fromEntries(
                    Object.entries(d.animalNames || {}).map(([id, name]) => [
                      id,
                      { ...v[id], name },
                    ]),
                  ),
                }));
                setFormError("");
              }
            }}
          >
            <option value="" disabled>
              Édition en cours · non partagée
            </option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {d.config.month}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => {
            setOptions(gazetteDefaults());
            setMonthEdits({});
            setDraftId(uid());
            setFormError("");
          }}
        >
          Nouvelle
        </Button>
        <Button
          variant="secondary"
          icon={Copy}
          onClick={() => {
            setDraftId(uid());
            notify(
              "Copie prête : enregistrez-la pour la partager avec l’équipe.",
            );
          }}
        >
          Dupliquer
        </Button>
        {drafts.some((d) => d.id === draftId) && (
          <Button
            variant="secondary"
            icon={Trash2}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/creative/gazette/drafts/${draftId}`, {
                  method: "DELETE",
                });
                setDraftId(uid());
                await loadDrafts();
                notify(
                  "Brouillon retiré. Le contenu reste ouvert dans l’éditeur.",
                );
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Retirer le brouillon
          </Button>
        )}
      </div>
      <div className="gazette-stat-strip">
        <span>
          <Heart size={18} />
          <b>{movements.filter((m) => m.kind === "adoption").length}</b>
          adoptions retenues
        </span>
        <span>
          <Plus size={18} />
          <b>{movements.filter((m) => m.kind === "arrival").length}</b>arrivées
          retenues
        </span>
        <span>
          <CalendarDays size={18} />
          <b>{dates.length}</b>dates clés
        </span>
      </div>
      <div className="gazette-layout">
        <div className="form-stack gazette-compose">
          <nav className="gazette-tabs" aria-label="Composer la gazette">
            {[
              ["overview", "Résumé automatique"],
              ["movements", "Arrivées & adoptions"],
              ["agenda", "Dates clés"],
              ["editorial", "Édito & style"],
              ["portraits", "À la une"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <label>
            Mois de l’édition
            <input
              type="month"
              min="2000-01"
              max="2099-12"
              value={options.month}
              onChange={(e) => {
                if (e.target.value) {
                  const savedMonths = {
                    ...monthEdits,
                    [options.month]: {
                      movements: options.movements,
                      excludedMovements: options.excludedMovements,
                    },
                  };
                  setMonthEdits(savedMonths);
                  setOptions((o) => ({
                    ...o,
                    month: e.target.value,
                    movements: savedMonths[e.target.value]?.movements || [],
                    excludedMovements:
                      savedMonths[e.target.value]?.excludedMovements || [],
                  }));
                  setSnapshot(null);
                  setAdding(null);
                  setAddDate("");
                }
              }}
            />
          </label>
          {snapshotError && (
            <p className="error" role="alert">
              {snapshotError}
              <button
                className="text-link"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Réessayer
              </button>
            </p>
          )}
          {tab === "overview" && (
            <div className="gazette-auto form-stack">
              <div className="gazette-auto-heading">
                <Sparkles size={22} />
                <div>
                  <strong>Votre édition est déjà remplie</strong>
                  <p>
                    Actualisée chaque minute · photos de l’équipe, sinon du site
                    SPA.
                  </p>
                </div>
                <Button
                  icon={RefreshCw}
                  variant="secondary"
                  aria-label="Actualiser les données de la gazette"
                  onClick={() => setRefresh((n) => n + 1)}
                />
              </div>
              {!currentSnapshot ? (
                <Spinner />
              ) : (
                <>
                  <div className="gazette-auto-options">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={options.autoSummary}
                        onChange={(e) => summaryMode(e.target.checked)}
                      />
                      Résumé automatique
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={options.autoPortraits}
                        onChange={(e) =>
                          patch("autoPortraits", e.target.checked)
                        }
                      />
                      Portraits automatiques
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={options.includeAgenda}
                        onChange={(e) =>
                          patch("includeAgenda", e.target.checked)
                        }
                      />
                      Dates de l’agenda
                    </label>
                  </div>
                  <p className="gazette-live-summary">{summary}</p>
                  <div className="gazette-auto-lists">
                    {[
                      ["adoption", "Familles trouvées"],
                      ["arrival", "Bienvenue au refuge"],
                    ].map(([kind, title]) => (
                      <section key={kind}>
                        <h4>
                          {title}{" "}
                          <span>
                            {movements.filter((m) => m.kind === kind).length}
                          </span>
                        </h4>
                        {movements.filter((m) => m.kind === kind).length ? (
                          <div>
                            {movements
                              .filter((m) => m.kind === kind)
                              .map((m) => (
                                <span
                                  className="gazette-animal-chip"
                                  key={movementKey(m)}
                                >
                                  <Thumb
                                    src={metadata[m.animalId]?.preview}
                                    name={m.name}
                                  />
                                  <strong>
                                    {metadata[m.animalId]?.name || m.name}
                                  </strong>
                                </span>
                              ))}
                          </div>
                        ) : (
                          <p>Aucun mouvement daté ce mois-ci.</p>
                        )}
                      </section>
                    ))}
                  </div>
                  <div className="gazette-auto-heading">
                    <div>
                      <h4>Les compagnons à rencontrer</h4>
                      <p>
                        Une sélection équilibrée entre chiens, chats et NAC.
                        Vous pouvez masquer un portrait.
                      </p>
                    </div>
                    {options.autoPortraits && (
                      <label>
                        Nombre de portraits
                        <select
                          value={options.portraitLimit}
                          onChange={(e) =>
                            patch("portraitLimit", +e.target.value)
                          }
                        >
                          {[6, 12, 18, 24].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="gazette-auto-portraits">
                    {portraits.map((a) => {
                      const meta = metadata[a.id] || {};
                      return (
                        <article key={a.id}>
                          <Thumb src={meta.preview} name={meta.name} />
                          <strong>{meta.name || "Animal"}</strong>
                          <button
                            className="icon-button"
                            aria-label={`Masquer ${meta.name || "ce portrait"}`}
                            onClick={() =>
                              setOptions((o) => ({
                                ...o,
                                animals: o.animals.filter((x) => x.id !== a.id),
                                excludedAnimals: [
                                  ...new Set([...o.excludedAnimals, a.id]),
                                ],
                              }))
                            }
                          >
                            <Minus size={16} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  {options.excludedAnimals.length > 0 && (
                    <button
                      className="text-link"
                      onClick={() => patch("excludedAnimals", [])}
                    >
                      Réintégrer les portraits masqués (
                      {options.excludedAnimals.length})
                    </button>
                  )}
                  <p className="fineprint">
                    Les nouvelles fiches sans date d’arrivée ne sont pas
                    comptées comme des arrivées. L’archivage seul ne compte pas
                    comme une adoption. Le nombre de compagnons présents reflète
                    la situation actuelle.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setTab("editorial")}
                  >
                    Ajouter le mot de l’équipe
                  </Button>
                </>
              )}
            </div>
          )}
          {tab === "editorial" && (
            <>
              <label>
                Titre
                <input
                  maxLength={65}
                  value={options.title}
                  onChange={(e) => patch("title", e.target.value)}
                />
              </label>
              <label>
                Style
                <select
                  value={options.template}
                  onChange={(e) => patch("template", e.target.value)}
                >
                  <option value="spa">SPA · clair et orange</option>
                  <option value="editorial">Éditorial · papier crème</option>
                  <option value="glass">Glass · verre fumé</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.autoSummary}
                  onChange={(e) => summaryMode(e.target.checked)}
                />
                Utiliser le résumé automatique
              </label>
              <label>
                Édito
                <textarea
                  maxLength={1200}
                  rows={6}
                  value={summary}
                  readOnly={options.autoSummary}
                  onChange={(e) => patch("introduction", e.target.value)}
                />
              </label>
              <label>
                Autres nouvelles
                <textarea
                  maxLength={2400}
                  rows={7}
                  value={options.events}
                  onChange={(e) => patch("events", e.target.value)}
                  placeholder="Les nouvelles du mois, une collecte, une belle rencontre…"
                />
              </label>
              <label>
                Le mot de l’équipe
                <textarea
                  maxLength={1800}
                  rows={6}
                  value={options.teamNote}
                  onChange={(e) => patch("teamNote", e.target.value)}
                />
              </label>
              <label>
                Signature
                <input
                  maxLength={100}
                  value={options.signature}
                  onChange={(e) => patch("signature", e.target.value)}
                />
              </label>
            </>
          )}
          {tab === "movements" && (
            <>
              <p>
                Les dates connues sont proposées automatiquement. Vous pouvez
                ajouter un mouvement, corriger sa date pour cette édition ou le
                masquer.
              </p>
              <div className="gazette-auto-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.includeAdoptions}
                    onChange={(e) =>
                      patch("includeAdoptions", e.target.checked)
                    }
                  />
                  Adoptions enregistrées
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.includeArrivals}
                    onChange={(e) => patch("includeArrivals", e.target.checked)}
                  />
                  Arrivées datées du site SPA
                </label>
              </div>
              <p className="fineprint">
                Une nouvelle fiche importée ne prouve pas une arrivée.
                L’archivage d’un animal ne compte pas comme une adoption. Vos
                corrections ici concernent la gazette.
              </p>
              <label>
                Rubrique
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Arrivées et adoptions</option>
                  <option value="adoption">Adoptions</option>
                  <option value="arrival">Arrivées</option>
                </select>
              </label>
              {!currentSnapshot ? (
                <Spinner />
              ) : (
                <div className="gazette-movements">
                  {allRows
                    .filter((m) => filter === "all" || m.kind === filter)
                    .map((row) => {
                      const meta = metadata[row.animalId] || row,
                        included = !options.excludedMovements.includes(
                          movementKey(row),
                        );
                      return (
                        <article
                          key={movementKey(row)}
                          className={`gazette-movement ${included ? "" : "excluded"}`}
                        >
                          <div className="gazette-movement-top">
                            <Thumb src={meta.preview} name={meta.name} />
                            <div>
                              <span className={`gazette-kind ${row.kind}`}>
                                {row.kind === "adoption"
                                  ? "Adoption"
                                  : "Arrivée"}
                              </span>
                              <strong>
                                {meta.name || row.name || "Animal"}
                              </strong>
                              <small>{sourceLabel(row)}</small>
                            </div>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={() => exclude(row)}
                              />
                              Inclure
                            </label>
                          </div>
                          <div className="gazette-row-fields">
                            <label>
                              Date
                              <input
                                type="date"
                                min={`${options.month}-01`}
                                max={endOfMonth}
                                value={row.date}
                                onChange={(e) => {
                                  if (e.target.value)
                                    changeMovement(row, {
                                      date: e.target.value,
                                    });
                                }}
                              />
                            </label>
                            <label>
                              Photo
                              <select
                                value={row.source || "auto"}
                                onChange={(e) =>
                                  changeMovement(row, {
                                    source: e.target.value,
                                  })
                                }
                              >
                                <option value="auto">Locale, sinon SPA</option>
                                <option value="spa">Site SPA</option>
                              </select>
                            </label>
                          </div>
                          <label>
                            Quelques mots
                            <textarea
                              rows={2}
                              maxLength={350}
                              value={row.note || ""}
                              onChange={(e) =>
                                changeMovement(row, { note: e.target.value })
                              }
                              placeholder="Une pensée pour lui, sa rencontre avec sa famille…"
                            />
                          </label>
                          {row.origin === "manual" && (
                            <button
                              className="text-link"
                              onClick={() =>
                                patch(
                                  "movements",
                                  options.movements.filter(
                                    (m) => movementKey(m) !== movementKey(row),
                                  ),
                                )
                              }
                            >
                              <RotateCcw size={13} />
                              Retirer ma saisie / retrouver la date source
                            </button>
                          )}
                        </article>
                      );
                    })}
                  {allRows.length === 0 && (
                    <p>
                      Aucun mouvement daté ce mois. Les portraits des compagnons
                      présents sont inclus automatiquement dans la gazette.
                    </p>
                  )}
                </div>
              )}
              <details className="gazette-add-movement">
                <summary>
                  <Plus size={17} />
                  Ajouter une arrivée ou une adoption
                </summary>
                <div className="form-stack">
                  <div className="gazette-row-fields">
                    <label>
                      Mouvement
                      <select
                        value={addKind}
                        onChange={(e) => setAddKind(e.target.value)}
                      >
                        <option value="arrival">Arrivée au refuge</option>
                        <option value="adoption">Adoption</option>
                      </select>
                    </label>
                    <label>
                      Date confirmée
                      <input
                        type="date"
                        required
                        min={`${options.month}-01`}
                        max={endOfMonth}
                        value={addDate}
                        onChange={(e) => setAddDate(e.target.value)}
                      />
                    </label>
                  </div>
                  {adding ? (
                    <div className="gazette-selection">
                      <Thumb src={adding.preview} />
                      <strong>{adding.name}</strong>
                      <button
                        className="text-link"
                        onClick={() => setAdding(null)}
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <WorkshopAnimalSearch allAnimals onSelect={setAdding} />
                  )}
                  <Button
                    icon={Plus}
                    disabled={!adding || !addDate}
                    onClick={addMovement}
                  >
                    Ajouter à cette édition
                  </Button>
                </div>
              </details>
              {snapshot?.added.filter((a) => !a.arrivalDate).length > 0 && (
                <details className="gazette-notice">
                  <summary>
                    {snapshot.added.filter((a) => !a.arrivalDate).length}{" "}
                    nouvelle(s) fiche(s) sans date d’arrivée
                  </summary>
                  <p>
                    Ces animaux ont été ajoutés à AniPic ce mois-ci. Vérifiez
                    leur date d’arrivée avant de les inclure.
                  </p>
                  <div className="gazette-suggestions">
                    {snapshot.added
                      .filter((a) => !a.arrivalDate)
                      .map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setAdding(a);
                            setAddKind("arrival");
                            setAddDate("");
                            const details = document.querySelector(
                              ".gazette-add-movement",
                            );
                            if (details) {
                              details.open = true;
                              details.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }
                          }}
                        >
                          {a.name}
                          <Plus size={13} />
                        </button>
                      ))}
                  </div>
                </details>
              )}
            </>
          )}
          {tab === "agenda" && (
            <>
              <div className="gazette-notice">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.includeAgenda}
                    onChange={(e) => patch("includeAgenda", e.target.checked)}
                  />
                  Reprendre automatiquement l’agenda partagé
                </label>
                <p>
                  Les rendez-vous de ce mois et du mois suivant, autorisés dans
                  la gazette, sont inclus sans nouvelle saisie.
                </p>
                <a className="text-link" href="#agenda">
                  Gérer l’agenda de l’équipe →
                </a>
              </div>
              {options.includeAgenda && (
                <div className="gazette-shared-dates">
                  {(currentSnapshot?.agenda || []).map((e) => (
                    <label className="checkbox-label" key={e.id}>
                      <input
                        type="checkbox"
                        checked={!options.excludedAgenda.includes(e.id)}
                        onChange={() =>
                          patch(
                            "excludedAgenda",
                            options.excludedAgenda.includes(e.id)
                              ? options.excludedAgenda.filter(
                                  (id) => id !== e.id,
                                )
                              : [...options.excludedAgenda, e.id],
                          )
                        }
                      />
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {agendaDateLabel(e.date)}
                          {e.time && ` · ${e.time}`}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p>
                Vous pouvez aussi ajouter une date uniquement pour cette
                édition.
              </p>
              <Button
                icon={Plus}
                variant="secondary"
                disabled={options.keyDates.length >= 40}
                onClick={() =>
                  patch("keyDates", [
                    ...options.keyDates,
                    {
                      id: uid(),
                      date: `${options.month}-01`,
                      time: "",
                      title: "Nouveau rendez-vous",
                      category: "event",
                      location: "",
                      description: "",
                    },
                  ])
                }
              >
                Ajouter une date clé
              </Button>
              <div className="gazette-agenda">
                {options.keyDates.map((event, index) => {
                  const change = (k, v) =>
                    patch(
                      "keyDates",
                      options.keyDates.map((e) =>
                        e.id === event.id ? { ...e, [k]: v } : e,
                      ),
                    );
                  return (
                    <article className="gazette-agenda-card" key={event.id}>
                      <div className="gazette-agenda-heading">
                        <CalendarDays size={22} />
                        <strong>Rendez-vous {index + 1}</strong>
                        <button
                          className="icon-button"
                          aria-label="Retirer cette date"
                          onClick={() =>
                            patch(
                              "keyDates",
                              options.keyDates.filter((e) => e.id !== event.id),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <label>
                        Intitulé
                        <input
                          required
                          maxLength={100}
                          value={event.title}
                          onChange={(e) => change("title", e.target.value)}
                        />
                      </label>
                      <div className="gazette-row-fields">
                        <label>
                          Date
                          <input
                            type="date"
                            min="2000-01-01"
                            max="2099-12-31"
                            required
                            value={event.date}
                            onChange={(e) => {
                              if (e.target.value)
                                change("date", e.target.value);
                            }}
                          />
                        </label>
                        <label>
                          Heure · facultative
                          <input
                            type="time"
                            value={event.time}
                            onChange={(e) => change("time", e.target.value)}
                          />
                        </label>
                      </div>
                      <label>
                        Type
                        <select
                          value={event.category}
                          onChange={(e) => change("category", e.target.value)}
                        >
                          {Object.entries(categories).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Lieu
                        <input
                          maxLength={120}
                          value={event.location}
                          onChange={(e) => change("location", e.target.value)}
                          placeholder="Refuge SPA de Morée…"
                        />
                      </label>
                      <label>
                        Précisions
                        <textarea
                          rows={4}
                          maxLength={500}
                          value={event.description}
                          onChange={(e) =>
                            change("description", e.target.value)
                          }
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
              {options.keyDates.length === 0 && (
                <p className="fineprint">
                  Les dates sont présentées dans un agenda illustré dans le PDF,
                  et les trois premières apparaissent sur le visuel réseaux.
                </p>
              )}
            </>
          )}
          {tab === "portraits" && (
            <>
              <p className="gazette-notice">
                {options.autoPortraits
                  ? `${portraits.length} portraits déjà sélectionnés automatiquement.`
                  : "La sélection automatique est désactivée."}{" "}
                <button
                  className="text-link"
                  onClick={() => setTab("overview")}
                >
                  Voir la sélection
                </button>
              </p>
              <p>
                Choisissez jusqu’à 24 animaux supplémentaires à mettre à la une.
                Ceux déjà dans les arrivées ou adoptions apparaissent dans leur
                rubrique.
              </p>
              <WorkshopAnimalSearch
                allAnimals
                onSelect={(a) => {
                  if (options.animals.some((x) => x.id === a.id)) return;
                  if (options.animals.length >= 24)
                    return notify("24 portraits à la une maximum.", "error");
                  setMetadata((v) => ({ ...v, [a.id]: a }));
                  patch("animals", [
                    ...options.animals,
                    { id: a.id, source: "auto" },
                  ]);
                }}
              />
              <div className="gazette-spotlights">
                {options.animals.map((a) => {
                  const meta = metadata[a.id] || {};
                  return (
                    <div key={a.id}>
                      <Thumb src={meta.preview} />
                      <strong>{meta.name || "Animal"}</strong>
                      <select
                        aria-label="Photo du portrait"
                        value={a.source}
                        onChange={(e) =>
                          patch(
                            "animals",
                            options.animals.map((x) =>
                              x.id === a.id
                                ? { ...x, source: e.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="auto">Locale, sinon SPA</option>
                        <option value="spa">Site SPA</option>
                      </select>
                      <button
                        className="icon-button"
                        aria-label="Retirer le portrait"
                        onClick={() =>
                          patch(
                            "animals",
                            options.animals.filter((x) => x.id !== a.id),
                          )
                        }
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="fineprint">
                Les photos privées restent exclues des exports.
              </p>
            </>
          )}
          {formError && (
            <p className="error-text gazette-notice" role="alert">
              {formError}
            </p>
          )}
          <div className="gazette-actions">
            <Button
              icon={Save}
              variant="secondary"
              disabled={busy || busyGenerating}
              onClick={save}
            >
              {busy ? "Enregistrement…" : "Enregistrer l’édition"}
            </Button>
            <Button
              icon={Newspaper}
              disabled={
                busy ||
                busyGenerating ||
                !options.title.trim() ||
                !currentSnapshot ||
                !!snapshotError
              }
              onClick={generate}
            >
              {busyGenerating ? "Préparation en cours…" : "Préparer la gazette"}
            </Button>
          </div>
          <p className="fineprint">
            Votre travail est mémorisé dans ce navigateur. Enregistrez l’édition
            pour la retrouver avec les autres comptes de l’équipe.
          </p>
        </div>
        <aside className="gazette-preview-column">
          <Exports job={job} dirty={dirty} notify={notify} />
        </aside>
      </div>
    </div>
  );
}
