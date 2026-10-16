import { useState, useEffect } from "react";
import {
  Camera,
  Plus,
  Check,
  Clock,
  Flag,
  Copy,
  RefreshCw,
  Rss,
  Download,
  Sparkles,
  Video,
  Archive,
  Users,
  Printer,
} from "lucide-react";
import { copyText, api, date, speciesName, imageUrl } from "./api.js";
import { Button, Empty, Spinner, Modal } from "./ui.jsx";
import { Weather } from "./home.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
import { priorityLabels } from "../shared/photo-priority.mjs";
import { TeamUtilities } from "./team-utilities.jsx";
export function TaskForm({ animal, close, notify, reload }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={"Demande photo · " + animal.name} onClose={close}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          try {
            await api("/tasks", {
              method: "POST",
              body: { ...data, animalId: animal.id },
            });
            notify("Demande ajoutée au planning photo.");
            reload();
            close();
          } catch (error) {
            notify(error.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Objet de la séance
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={"Portraits de " + animal.name}
          />
        </label>
        <label>
          Priorité
          <select
            name="priority"
            defaultValue={animal.photo_priority || "normal"}
          >
            <option value="urgent">Urgente</option>
            <option value="high">Haute</option>
            <option value="normal">Normale</option>
            <option value="low">Quand possible</option>
          </select>
        </label>
        <label>
          Notes pour le photographe
          <textarea
            name="note"
            rows={4}
            maxLength={2000}
            placeholder="Portrait dehors, photo de profil, montrer son énergie…"
          />
        </label>
        <p className="fineprint">
          Ces notes restent dans l’espace équipe et ne sont pas envoyées à l’IA.
        </p>
        <Button icon={Flag} disabled={busy}>
          Ajouter la demande
        </Button>
      </form>
    </Modal>
  );
}
export function ShootBoard({
  user,
  canEdit,
  version,
  open,
  notify,
  reload,
  go,
  pushUndo,
}) {
  const [tasks, setTasks] = useState(null),
    [animals, setAnimals] = useState([]),
    [query, setQuery] = useState(""),
    [showDone, setShowDone] = useState(false),
    [missing, setMissing] = useState([]),
    [missingPage, setMissingPage] = useState(1),
    [missingPages, setMissingPages] = useState(1);
  useEffect(() => {
    if (!user) return;
    api("/tasks")
      .then(setTasks)
      .catch((e) => notify(e.message, "error"));
  }, [user?.id, version]);
  useEffect(() => {
    if (!user) return;
    api("/animals?missing=1&sort=photo_priority&limit=24&page=" + missingPage)
      .then((data) => {
        setMissing(data.items);
        setMissingPages(data.pages);
      })
      .catch((e) => notify(e.message, "error"));
  }, [user?.id, version, missingPage]);
  useEffect(() => {
    if (query.trim().length < 1) {
      setAnimals([]);
      return;
    }
    const timer = setTimeout(
      () =>
        api("/animals?q=" + encodeURIComponent(query) + "&limit=20")
          .then((data) => setAnimals(data.items))
          .catch(() => {}),
      250,
    );
    return () => clearTimeout(timer);
  }, [query]);
  if (!user)
    return (
      <Empty
        icon={Camera}
        title="Le planning de l’équipe."
        text="Connectez-vous pour consulter les priorités et demander une séance photo."
        action={
          <Button onClick={() => open({ type: "login" })}>Se connecter</Button>
        }
      />
    );
  const update = async (task, body) => {
    try {
      const result = await api("/tasks/" + task.id, {
        method: "PATCH",
        body,
        headers: { "X-Anipic-Version": task.updated_at },
      });
      const previous = Object.fromEntries(
        Object.keys(body).map((k) => [k, task[k]]),
      );
      pushUndo?.({
        label: `Planning · ${task.animal_name}`,
        key: `task:${task.id}`,
        previousRevision: task.updated_at,
        revision: result.updatedAt,
        run: (revision) =>
          api("/tasks/" + task.id, {
            method: "PATCH",
            body: previous,
            headers: { "X-Anipic-Version": revision || result.updatedAt },
          }),
      });
      notify("Planning mis à jour.");
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Planning photo</h1>
        </div>
        <div className="heading-actions">
          <Button
            icon={Printer}
            variant="secondary"
            onClick={() => {
              sessionStorage.setItem("anipic-sheet-mode", "priorities");
              go("print");
            }}
          >
            Liste imprimable
          </Button>
          <span className="tag sand">
            {tasks?.filter((t) => t.state !== "done").length || 0} demande(s)
            ouverte(s)
          </span>
        </div>
      </div>
      {canEdit && (
        <section className="panel request-search">
          <label>
            Demander une séance pour un animal
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher son nom…"
            />
          </label>
          {animals.length > 0 && (
            <div className="request-results">
              {animals.map((animal) => (
                <button
                  key={animal.id}
                  onClick={() => {
                    open({ type: "task", animal });
                    setQuery("");
                  }}
                >
                  {animal.cover_id && (
                    <img src={imageUrl(animal.cover_id, 320)} alt="" />
                  )}
                  <span>
                    {animal.name}
                    <small>
                      {speciesName[animal.species]} ·{" "}
                      {animal.source_id || animal.id.slice(0, 8)}
                    </small>
                  </span>
                  <Plus size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="board-toolbar">
        <h2>La liste des priorités</h2>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Voir les séances terminées
        </label>
      </div>
      {!tasks ? (
        <Spinner />
      ) : tasks.filter((t) => showDone || t.state !== "done").length === 0 ? (
        <Empty
          icon={Check}
          title="Aucune demande en attente."
          text="Choisissez un animal ci-dessus pour préparer la prochaine séance."
        />
      ) : (
        <div className="shoot-board">
          {tasks
            .filter((t) => showDone || t.state !== "done")
            .map((task) => (
              <article
                key={task.id}
                className={"task-card priority-" + task.priority}
              >
                <div className="task-top">
                  <span className={"priority-pill " + task.priority}>
                    {
                      {
                        urgent: "Urgente",
                        high: "Haute",
                        normal: "Normale",
                        low: "Quand possible",
                      }[task.priority]
                    }
                  </span>
                  <span>
                    {task.state === "done"
                      ? "Terminée"
                      : task.state === "progress"
                        ? "En traitement"
                        : "À faire"}
                  </span>
                </div>
                <button
                  className="task-animal"
                  onClick={() => open({ type: "animal", id: task.animal_id })}
                >
                  {task.cover_id ? (
                    <img src={imageUrl(task.cover_id, 320)} alt="" />
                  ) : (
                    <span className="task-spa-portrait">
                      <SpaPhoto
                        animal={{
                          ...task,
                          id: task.animal_id,
                          name: task.animal_name,
                        }}
                        compact
                      />
                    </span>
                  )}
                  <strong>
                    {task.animal_name}
                    <small>{task.title}</small>
                  </strong>
                </button>
                <p>
                  {task.note || "Une nouvelle série de portraits à préparer."}
                </p>
                <div className="task-bottom">
                  <small>
                    {task.author || "Équipe"} · {date(task.created_at)}
                  </small>
                  {canEdit && (
                    <select
                      aria-label={"État de la séance " + task.animal_name}
                      value={task.state}
                      onChange={(e) => update(task, { state: e.target.value })}
                    >
                      <option value="todo">À faire</option>
                      <option value="progress">
                        Photographié · en traitement
                      </option>
                      <option value="done">Terminée</option>
                    </select>
                  )}
                </div>
                {canEdit && (
                  <select
                    aria-label={"Priorité de " + task.animal_name}
                    value={task.priority}
                    onChange={(e) => update(task, { priority: e.target.value })}
                  >
                    <option value="urgent">Urgente</option>
                    <option value="high">Haute</option>
                    <option value="normal">Normale</option>
                    <option value="low">Quand possible</option>
                  </select>
                )}
              </article>
            ))}
        </div>
      )}
      <section className="panel section-gap missing-panel">
        <div className="panel-heading">
          <h2>Sans photo locale</h2>
          <span>
            {missingPage} / {Math.max(1, missingPages)}
          </span>
        </div>
        <div className="missing-grid">
          {missing.map((a) => (
            <button
              key={a.id}
              onClick={() =>
                open(
                  canEdit
                    ? { type: "task", animal: a }
                    : { type: "animal", id: a.id },
                )
              }
            >
              <span className="missing-portrait">
                {a.source_metadata?.thumbnail ? (
                  <SpaPhoto animal={a} />
                ) : (
                  <Camera size={20} />
                )}
              </span>
              <span className="missing-animal-info">
                <strong>{a.name}</strong>
                <small>
                  {speciesName[a.species]} · {a.photo_priority_reason}
                </small>
                <span className={"priority-pill " + a.photo_priority}>
                  {priorityLabels[a.photo_priority]}
                </span>
              </span>
              {canEdit && <Plus size={15} />}
            </button>
          ))}
        </div>
        {missingPages > 1 && (
          <div className="pagination">
            <Button
              variant="secondary"
              disabled={missingPage === 1}
              onClick={() => setMissingPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="secondary"
              disabled={missingPage >= missingPages}
              onClick={() => setMissingPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
export function AgentTools({ notify, open, go }) {
  const [sex, setSex] = useState("any"),
    [letter, setLetter] = useState(""),
    [names, setNames] = useState([]),
    [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      const data = await api(
        "/tools/names?sex=" + sex + "&letter=" + encodeURIComponent(letter),
      );
      setNames(data.names);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    generate();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LE COUP DE POUCE DE L’ÉQUIPE</div>
          <h1>Outils de l’équipe</h1>
          <p>Un prénom, un créneau de lumière, une prochaine histoire.</p>
        </div>
      </div>
      <TeamUtilities go={go} />
      <div className="tools-grid">
        <section className="panel names-tool">
          <div className="panel-heading">
            <h2>Comment va-t-on l’appeler ?</h2>
            <Sparkles size={23} />
          </div>
          <p>
            Des idées selon le sexe et une lettre. Les prénoms déjà présents au
            refuge sont exclus.
          </p>
          <div className="form-row">
            <label>
              Sexe
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="any">Toutes les idées</option>
                <option value="female">Femelle</option>
                <option value="male">Mâle</option>
              </select>
            </label>
            <label>
              Première lettre
              <input
                value={letter}
                maxLength={1}
                onChange={(e) => setLetter(e.target.value)}
                placeholder="Facultatif"
              />
            </label>
          </div>
          <Button icon={RefreshCw} disabled={busy} onClick={generate}>
            Trouver des prénoms
          </Button>
          <div className="name-chips">
            {names.map((name) => (
              <button
                key={name}
                onClick={() =>
                  copyText(name)
                    .then(() => notify(name + " copié."))
                    .catch(() => notify("Copie indisponible.", "error"))
                }
              >
                {name}
                <Copy size={13} />
              </button>
            ))}
          </div>
          {!names.length && !busy && (
            <p>
              Aucun prénom trouvé pour cette lettre. Essayez une autre initiale.
            </p>
          )}
        </section>
        <section className="panel weather-full">
          <Weather />
        </section>
      </div>
    </>
  );
}
export { Feed } from "./shelter-feed.jsx";
export function SocialDraft({ animal, photoId, close, notify, overview }) {
  const [poster, setPoster] = useState({
      format: "portrait",
      style: "glass",
      accent: overview?.interface?.accentColor || "#f4ab70",
      cta: "Venez me rencontrer",
      refuge: overview?.refugeName || "Refuge de Morée",
      facts: "1",
    }),
    [posterPhoto, setPosterPhoto] = useState(photoId || animal.cover_id || ""),
    [posterPhotos, setPosterPhotos] = useState(animal.photos || []);
  useEffect(() => {
    api("/animals/" + animal.id)
      .then((a) => {
        setPosterPhotos(a.photos.filter((p) => !p.archived_at));
        if (!posterPhoto)
          setPosterPhoto(a.photos.find((p) => !p.archived_at)?.id || "");
      })
      .catch(() => {});
  }, [animal.id]);
  const [posterPreviewURL, setPosterPreviewURL] = useState("");
  const posterURL =
    "/api/animals/" +
    animal.id +
    "/presentation?" +
    new URLSearchParams({
      ...poster,
      ...(posterPhoto ? { photoId: posterPhoto } : {}),
    });
  useEffect(() => {
    const timer = setTimeout(
      () => setPosterPreviewURL(posterURL + "&inline=1&preview=1"),
      250,
    );
    return () => clearTimeout(timer);
  }, [posterURL]);
  const [provider, setProvider] = useState("local"),
    [tone, setTone] = useState("warm"),
    [text, setText] = useState(""),
    [status, setStatus] = useState({}),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/social/status")
      .then(setStatus)
      .catch(() => {});
  }, []);
  const generate = async () => {
    setBusy(true);
    try {
      const result = await api("/animals/" + animal.id + "/post", {
        method: "POST",
        body: { provider, tone },
      });
      setText(result.text);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={"Préparer une publication · " + animal.name}
      onClose={close}
      wide
    >
      <div className="social-layout">
        <div>
          {posterPhoto && (
            <img
              className="social-photo poster-preview"
              src={posterPreviewURL || undefined}
              alt={"Visuel de publication de " + animal.name}
            />
          )}
          <div className="form-stack poster-settings">
            <h3>Visuel configurable</h3>
            <label>
              Photo
              <select
                value={posterPhoto}
                onChange={(e) => setPosterPhoto(e.target.value)}
              >
                {posterPhotos.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    Photo {i + 1} · {p.filename}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Format
                <select
                  value={poster.format}
                  onChange={(e) =>
                    setPoster((p) => ({ ...p, format: e.target.value }))
                  }
                >
                  <option value="portrait">Publication 4:5</option>
                  <option value="square">Carré 1:1</option>
                  <option value="story">Story 9:16</option>
                </select>
              </label>
              <label>
                Overlay
                <select
                  value={poster.style}
                  onChange={(e) =>
                    setPoster((p) => ({ ...p, style: e.target.value }))
                  }
                >
                  <option value="glass">Dégradé cinéma</option>
                  <option value="banner">Bandeau éditorial</option>
                  <option value="minimal">Cartouche minimal</option>
                </select>
              </label>
            </div>
            <label>
              Couleur
              <input
                type="color"
                value={poster.accent}
                onChange={(e) =>
                  setPoster((p) => ({ ...p, accent: e.target.value }))
                }
              />
            </label>
            <label>
              Invitation
              <input
                maxLength="80"
                value={poster.cta}
                onChange={(e) =>
                  setPoster((p) => ({ ...p, cta: e.target.value }))
                }
              />
            </label>
            <label>
              Signature du refuge
              <input
                maxLength="100"
                value={poster.refuge}
                onChange={(e) =>
                  setPoster((p) => ({ ...p, refuge: e.target.value }))
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={poster.facts === "1"}
                onChange={(e) =>
                  setPoster((p) => ({
                    ...p,
                    facts: e.target.checked ? "1" : "0",
                  }))
                }
              />
              Afficher les informations SPA
            </label>
          </div>
          <a className="button secondary" href={posterURL}>
            <Download size={16} />
            Télécharger le visuel
          </a>
          <p className="fineprint">
            Le visuel et le texte se téléchargent séparément. La publication
            Facebook reste à valider et publier par l’équipe.
          </p>
        </div>
        <div className="form-stack">
          <div className="form-row">
            <label>
              Rédaction
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="local">Locale · sans IA</option>
                <option value="gemini" disabled={!status.gemini}>
                  Gemini {!status.gemini ? "· clé à configurer" : ""}
                </option>
                <option value="tokenharbor" disabled={!status.tokenharbor}>
                  Token Harbor {!status.tokenharbor ? "· clé à configurer" : ""}
                </option>
              </select>
            </label>
            <label>
              Ton
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="warm">Chaleureux</option>
                <option value="short">Court</option>
              </select>
            </label>
          </div>
          {provider !== "local" && (
            <p className="notice compact">
              Le bouton transmet uniquement la fiche publique de l’animal au
              service sélectionné. Les photos et notes de séance restent sur
              votre serveur.
            </p>
          )}
          <Button icon={Sparkles} onClick={generate} disabled={busy}>
            {busy ? "Rédaction…" : "Préparer le brouillon"}
          </Button>
          <label>
            Texte à relire
            <textarea
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Préparez puis personnalisez votre publication…"
            />
          </label>
          <div className="form-row">
            <Button
              icon={Copy}
              disabled={!text}
              onClick={() =>
                copyText(text)
                  .then(() => notify("Brouillon copié."))
                  .catch(() => notify("Copie indisponible.", "error"))
              }
            >
              Copier le texte
            </Button>
            <a
              className={"button secondary " + (!text ? "disabled" : "")}
              href={"data:text/plain;charset=utf-8," + encodeURIComponent(text)}
              download={animal.name + "-publication.txt"}
            >
              Télécharger le texte
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
