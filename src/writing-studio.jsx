import { useEffect, useState, useRef } from "react";
import { FilePenLine, Copy, RotateCcw, ChevronDown } from "lucide-react";
import { api, copyText, imageUrl, speciesName } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
import RichWriting from "./rich-writing.jsx";
import { WritingPreview } from "./writing-review.jsx";
import { createWritingGeneration } from "../shared/writing-generation.mjs";
export default function WritingStudio({ user, notify }) {
  const [data, setData] = useState(null),
    [tab, setTab] = useState("create"),
    [filter, setFilter] = useState("issues"),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState(""),
    [form, setForm] = useState({
      name: "",
      species: "dog",
      keywords: "",
      original: "",
      mode: "create",
      provider: "tokenharbor",
      tone: "chaleureux",
      emojis: true,
    }),
    [proposal, setProposal] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState([]),
    [context, setContext] = useState(0),
    [pickerOpen, setPickerOpen] = useState(true);
  const generation = useRef(null);
  if (!generation.current) generation.current = createWritingGeneration();
  useEffect(() => {
    let live = true;
    setData(null);
    setDrafts([]);
    setBusy(false);
    setError("");
    setProposal("");
    setSelected("");
    setPickerOpen(true);
    setContext((v) => v + 1);
    setForm((f) => ({ ...f, name: "", original: "", keywords: "" }));
    if (user)
      Promise.all([api("/writing/review"), api("/writing/drafts")])
        .then(([d, h]) => {
          if (!live) return;
          setData(d);
          if (!d.ai.tokenharbor) setForm((f) => ({ ...f, provider: "local" }));
          setDrafts(h.drafts);
        })
        .catch((e) => live && setError(e.message));
    return () => {
      live = false;
      generation.current.invalidate();
    };
  }, [user?.id]);
  const resetContext = () => {
    generation.current.invalidate();
    setBusy(false);
    setError("");
    setProposal("");
    setContext((v) => v + 1);
  };
  const editForm = (patch) => {
    if (busy) {
      generation.current.invalidate();
      setBusy(false);
    }
    setForm((f) => ({ ...f, ...patch }));
  };
  const choose = (a) => {
    resetContext();
    setSelected(a.id);
    setPickerOpen(false);
    setForm((f) => ({
      ...f,
      name: a.name,
      species: a.species,
      original: a.description,
      keywords: "",
      mode: tab === "review" ? "correct" : "create",
    }));
  };
  if (!user) return <p>Connectez-vous pour utiliser l’atelier de rédaction.</p>;
  if (!data) return error ? <p role="alert">{error}</p> : <Spinner />;
  const reviewing = form.mode === "correct",
    chosen = data.animals.find((a) => a.id === selected),
    visibleAnimals = data.animals.filter(
      (a) =>
        a.name
          .toLocaleLowerCase("fr")
          .includes(q.trim().toLocaleLowerCase("fr")) &&
        (!reviewing ||
          filter === "all" ||
          (filter === "photos" && !a.localPhotos) ||
          (filter === "issues" && a.issues.length)),
    );
  return (
    <div className="writing-studio writing314">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DES MOTS POUR UNE RENCONTRE</div>
          <h1>Rédaction & relecture</h1>
        </div>
        <FilePenLine size={30} />
      </div>
      <nav
        className="activity-tabs writing-tabs"
        aria-label="Atelier de rédaction"
      >
        <button
          aria-pressed={tab === "create"}
          onClick={() => {
            if (reviewing) {
              resetContext();
              setForm({ ...form, mode: "create" });
            }
            setTab("create");
          }}
        >
          Présenter un animal
        </button>
        <button
          aria-pressed={tab === "review"}
          onClick={() => {
            if (!reviewing) {
              resetContext();
              setForm({ ...form, mode: "correct" });
            }
            setTab("review");
          }}
        >
          Relire les fiches SPA
        </button>
        <button
          aria-pressed={tab === "history"}
          onClick={() => {
            generation.current.invalidate();
            setBusy(false);
            setError("");
            setTab("history");
          }}
        >
          Mes propositions
        </button>
      </nav>
      {tab === "history" && (
        <div className="writing-history">
          <p className="small-note">
            Les propositions générées sont conservées ici. Les retouches faites
            dans l’éditeur ne sont pas enregistrées.
          </p>
          {drafts.length ? (
            drafts.map((d) => {
              const animal = data.animals.find((a) => a.id === d.animal_id),
                review = d.mode.endsWith(":correct");
              return (
                <article className="panel" key={d.id}>
                  <header>
                    <div>
                      <h2>
                        {animal?.name || "Texte libre ou fiche indisponible"}
                      </h2>
                      <span className="small-note">
                        {review ? "Relecture" : "Présentation"}
                      </span>
                    </div>
                    <time>
                      {new Date(d.created_at).toLocaleString("fr-FR")}
                    </time>
                  </header>
                  <details className="writing-history-text">
                    <summary>Lire la proposition</summary>
                    <WritingPreview text={d.proposal} />
                  </details>
                  <div className="writing-history-actions">
                    <Button
                      icon={RotateCcw}
                      onClick={() => {
                        resetContext();
                        setTab(review ? "review" : "create");
                        setSelected(animal?.id || "");
                        setPickerOpen(false);
                        setForm((f) => ({
                          ...f,
                          name: animal?.name || "Texte repris",
                          species: animal?.species || "other",
                          original: d.original,
                          keywords: "",
                          mode: review ? "correct" : "create",
                        }));
                        setProposal(d.proposal);
                      }}
                    >
                      Reprendre
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        copyText(d.proposal)
                          .then(() => notify("Texte copié."))
                          .catch(() =>
                            notify(
                              "Copie impossible sur cet appareil.",
                              "error",
                            ),
                          )
                      }
                    >
                      Copier
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <p>Aucune proposition enregistrée.</p>
          )}
        </div>
      )}
      <div className="writing-grid writing-layout" hidden={tab === "history"}>
        <aside
          className={`panel writing-list writing-side ${pickerOpen ? "picker-open" : ""}`}
        >
          <button
            className="writing-picker-toggle"
            type="button"
            aria-expanded={pickerOpen}
            aria-controls="writing-animal-picker"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <span>
              {chosen ? chosen.name : "Choisir un animal"}
              <small>
                {chosen ? "Changer d’animal" : "Ou commencer un texte libre"}
              </small>
            </span>
            <ChevronDown size={18} />
          </button>
          <div className="writing-picker-content" id="writing-animal-picker">
            <h2>
              {reviewing ? "À relire ou photographier" : "Choisir un animal"}
            </h2>
            <input
              placeholder="Rechercher un animal…"
              aria-label="Rechercher"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {reviewing && (
              <select
                aria-label="Fiches à afficher"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="issues">Texte à relire</option>
                <option value="photos">Sans photo locale</option>
                <option value="all">Toutes les fiches</option>
              </select>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                resetContext();
                setSelected("");
                setPickerOpen(false);
                setForm({
                  ...form,
                  name: "",
                  species: "dog",
                  original: "",
                  keywords: "",
                });
              }}
            >
              Nouvel animal sans fiche
            </Button>
            <p className="writing-list-count" role="status">
              {visibleAnimals.length} fiche
              {visibleAnimals.length > 1 ? "s" : ""}
            </p>
            <div className="writing-animal-list">
              {visibleAnimals.map((a) => (
                <button
                  className={selected === a.id ? "selected" : ""}
                  aria-pressed={selected === a.id}
                  key={a.id}
                  onClick={() => choose(a)}
                >
                  {a.cover_id ? (
                    <img
                      className="writing-portrait"
                      src={imageUrl(a.cover_id, 320)}
                      alt={a.name}
                      loading="lazy"
                    />
                  ) : (
                    <SpaPhoto animal={a} compact watermark={false} />
                  )}
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.localPhotos
                        ? "Portraits locaux présents"
                        : "Portrait local à réaliser"}
                    </small>
                    {a.issues.map((i) => (
                      <small key={i}>{i}</small>
                    ))}
                  </span>
                </button>
              ))}
              {!visibleAnimals.length && (
                <p className="small-note">
                  Aucune fiche ne correspond. Modifiez la recherche ou le
                  filtre.
                </p>
              )}
            </div>
            <p className="small-note">
              Les repères automatiques signalent des textes à relire. Ils ne
              remplacent pas une relecture humaine.
            </p>
          </div>
        </aside>
        <div className={`writing-main ${proposal ? "has-proposal" : ""}`}>
          <section className="panel writing-form">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generation.current.run({
                  onStart: () => {
                    setBusy(true);
                    setError("");
                    setProposal("");
                  },
                  request: () =>
                    api("/writing/generate", {
                      method: "POST",
                      body: {
                        ...form,
                        ...(selected ? { animalId: selected } : {}),
                      },
                    }),
                  onResult: async (r, isCurrent) => {
                    setProposal(r.proposal);
                    const h = await api("/writing/drafts");
                    if (isCurrent()) setDrafts(h.drafts);
                  },
                  onError: (error) => setError(error.message),
                  onFinish: () => setBusy(false),
                });
              }}
            >
              <div className="writing-editor-heading">
                <span className="eyebrow">
                  {reviewing
                    ? "01 / LE TEXTE À RELIRE"
                    : "01 / LES FAITS VÉRIFIÉS"}
                </span>
                <h2>{form.name || "Une nouvelle rencontre"}</h2>
                <p>
                  {reviewing
                    ? "Comparez les corrections proposées, sans changer le sens du texte."
                    : "Quelques mots simples suffisent pour préparer une présentation accueillante."}
                </p>
              </div>
              <div className="form-row">
                <label>
                  Prénom
                  <input
                    required
                    value={form.name}
                    maxLength="100"
                    readOnly={Boolean(selected)}
                    onChange={(e) => editForm({ name: e.target.value })}
                  />
                </label>
                <label>
                  Espèce
                  <select
                    value={form.species}
                    disabled={Boolean(selected)}
                    onChange={(e) => editForm({ species: e.target.value })}
                  >
                    {Object.entries(speciesName).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="writing-source-field">
                <span>
                  {reviewing
                    ? "Texte à corriger"
                    : "Texte de départ (facultatif)"}
                </span>
                <RichWriting
                  key={context}
                  value={form.original}
                  onChange={(value) => editForm({ original: value })}
                  proposed={reviewing && proposal ? proposal : null}
                  label={
                    reviewing
                      ? "Texte de travail, corrections soulignées"
                      : "Texte de départ"
                  }
                  maxLength={6000}
                  notify={notify}
                />
              </div>
              {!reviewing && (
                <label>
                  Faits et mots-clés vérifiés
                  <textarea
                    rows="3"
                    maxLength="2000"
                    placeholder="Ex. calme, aime les promenades, besoin d’un jardin sécurisé…"
                    value={form.keywords}
                    onChange={(e) => editForm({ keywords: e.target.value })}
                  />
                </label>
              )}
              <details className="writing-options">
                <summary>
                  Options de rédaction{" "}
                  <span>
                    {form.provider === "local" ? "Sans IA" : "Avec IA"}
                  </span>
                  <ChevronDown size={15} />
                </summary>
                <div>
                  <label>
                    Génération
                    <select
                      value={form.provider}
                      onChange={(e) => editForm({ provider: e.target.value })}
                    >
                      <option value="local">
                        Sans IA · composition simple
                      </option>
                      <option
                        value="tokenharbor"
                        disabled={!data.ai.tokenharbor}
                      >
                        {data.ai.tokenharbor
                          ? "Avec IA · Token Harbor"
                          : "Avec IA · non configurée"}
                      </option>
                    </select>
                  </label>
                  {form.provider === "tokenharbor" && !reviewing && (
                    <label>
                      Style
                      <select
                        value={form.tone}
                        onChange={(e) => editForm({ tone: e.target.value })}
                      >
                        {["chaleureux", "sobre", "dynamique"].map((tone) => (
                          <option key={tone}>{tone}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {form.provider === "tokenharbor" && (
                    <p className="small-note">
                      En générant, vous envoyez ce texte et le nom de l’animal
                      au service IA configuré. Évitez les informations
                      personnelles.
                    </p>
                  )}
                  {!reviewing && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={form.emojis}
                        onChange={(e) => editForm({ emojis: e.target.checked })}
                      />
                      Ajouter quelques émojis utiles 🐾
                    </label>
                  )}
                </div>
              </details>
              <Button
                loading={busy}
                disabled={
                  busy ||
                  form.original.length > 6000 ||
                  form.keywords.length > 2000
                }
                type="submit"
              >
                {busy
                  ? "Rédaction en cours…"
                  : reviewing
                    ? "Proposer une correction"
                    : "Générer une présentation"}
              </Button>
            </form>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </section>
          {proposal && (
            <section
              className="panel writing-proposal"
              aria-label="Proposition et texte retenu"
            >
              <span className="eyebrow">02 / VOTRE PROPOSITION</span>
              <h2>
                {reviewing ? "Votre version retenue" : "Votre présentation"}
              </h2>
              {reviewing ? (
                <>
                  <p>
                    Examinez les corrections dans le texte de travail. Vos
                    modifications manuelles et vos refus sont conservés.
                  </p>
                  <Button
                    icon={Copy}
                    onClick={() =>
                      copyText(form.original)
                        .then(() => notify("Version retenue copiée."))
                        .catch(() =>
                          notify("Copie impossible sur cet appareil.", "error"),
                        )
                    }
                  >
                    Copier ma version
                  </Button>
                </>
              ) : (
                <RichWriting
                  value={proposal}
                  onChange={setProposal}
                  label="Votre présentation finale"
                  checkText={false}
                  notify={notify}
                />
              )}

              <p>
                Relisez les faits et les ententes avant publication. Aucun texte
                du site SPA n’a été modifié.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
