import { useEffect, useState, useRef } from "react";
import {
  FilePenLine,
  Copy,
  Search,
  Check,
  Camera,
  LoaderCircle,
} from "lucide-react";
import { api, copyText, imageUrl } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
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
      provider: "local",
      tone: "chaleureux",
    }),
    [proposal, setProposal] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState([]);
  const generation = useRef(0);
  useEffect(() => {
    if (user)
      Promise.all([api("/writing/review"), api("/writing/drafts")])
        .then(([d, h]) => {
          setData(d);
          setDrafts(h.drafts);
        })
        .catch((e) => setError(e.message));
  }, [user?.id]);
  const choose = (a) => {
    generation.current++;
    setSelected(a.id);
    setProposal("");
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
  return (
    <div className="writing-studio">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DES MOTS POUR UNE RENCONTRE</div>
          <h1>Rédaction & relecture</h1>
        </div>
        <FilePenLine size={30} />
      </div>
      <div className="activity-tabs">
        <button
          aria-pressed={tab === "create"}
          onClick={() => {
            setTab("create");
            setForm({ ...form, mode: "create" });
          }}
        >
          Présenter un animal
        </button>
        <button
          aria-pressed={tab === "review"}
          onClick={() => {
            setTab("review");
            setForm({ ...form, mode: "correct" });
          }}
        >
          Relire les fiches SPA
        </button>
        <button
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          Mes propositions
        </button>
      </div>
      {tab === "history" ? (
        <div className="writing-history">
          {drafts.length ? (
            drafts.map((d) => (
              <article className="panel" key={d.id}>
                <time>{new Date(d.created_at).toLocaleString("fr-FR")}</time>
                <p>{d.proposal}</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    copyText(d.proposal).then(() => notify("Texte copié."))
                  }
                >
                  Copier
                </Button>
              </article>
            ))
          ) : (
            <p>Aucune proposition enregistrée.</p>
          )}
        </div>
      ) : (
        <div className="writing-grid">
          <aside className="panel writing-list">
            <h2>
              {tab === "review"
                ? "À relire ou photographier"
                : "Choisir un animal"}
            </h2>
            <input
              placeholder="Rechercher un animal…"
              aria-label="Rechercher"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {tab === "review" && (
              <select
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
                setSelected("");
                setProposal("");
                setForm({ ...form, name: "", original: "", keywords: "" });
              }}
            >
              Nouvel animal sans fiche
            </Button>
            <div className="writing-animal-list">
              {data.animals
                .filter(
                  (a) =>
                    a.name.toLowerCase().includes(q.toLowerCase()) &&
                    (tab !== "review" ||
                      filter === "all" ||
                      (filter === "photos" && !a.localPhotos) ||
                      (filter === "issues" && a.issues.length)),
                )
                .map((a) => (
                  <button
                    className={selected === a.id ? "selected" : ""}
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
            </div>
            <p className="small-note">
              Les repères automatiques signalent des textes à relire. Ils ne
              remplacent pas une relecture humaine.
            </p>
          </aside>
          <section className="panel writing-form">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const seq = ++generation.current;
                setBusy(true);
                setError("");
                try {
                  const r = await api("/writing/generate", {
                    method: "POST",
                    body: {
                      ...form,
                      ...(selected ? { animalId: selected } : {}),
                    },
                  });
                  if (seq === generation.current) {
                    setProposal(r.proposal);
                    const h = await api("/writing/drafts");
                    setDrafts(h.drafts);
                  }
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-row">
                <label>
                  Prénom
                  <input
                    required
                    value={form.name}
                    maxLength="100"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Style
                  <select
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  >
                    {["chaleureux", "sobre", "dynamique"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {tab === "review"
                  ? "Texte à corriger"
                  : "Texte de départ (facultatif)"}
                <textarea
                  rows="7"
                  maxLength="6000"
                  value={form.original}
                  onChange={(e) =>
                    setForm({ ...form, original: e.target.value })
                  }
                />
              </label>
              {tab === "create" && (
                <label>
                  Faits et mots-clés vérifiés
                  <textarea
                    rows="3"
                    maxLength="2000"
                    placeholder="Ex. calme, aime les promenades, besoin d’un jardin sécurisé…"
                    value={form.keywords}
                    onChange={(e) =>
                      setForm({ ...form, keywords: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                Génération
                <select
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value })
                  }
                >
                  <option value="local">Sans IA · composition simple</option>
                  <option value="tokenharbor" disabled={!data.ai.tokenharbor}>
                    Token Harbor configuré
                  </option>
                </select>
              </label>
              {form.provider === "tokenharbor" && (
                <p className="small-note">
                  En générant, vous envoyez ce texte et le nom de l’animal au
                  service IA configuré. Évitez les informations personnelles.
                </p>
              )}
              <Button disabled={busy} type="submit">
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={17} />
                    Rédaction en cours…
                  </>
                ) : tab === "review" ? (
                  "Proposer une correction"
                ) : (
                  "Générer une présentation"
                )}
              </Button>
            </form>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {proposal && (
              <div className="writing-proposal">
                <h2>Votre proposition</h2>
                <textarea
                  rows="9"
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                />
                <Button
                  icon={Copy}
                  onClick={() =>
                    copyText(proposal).then(() => notify("Texte copié."))
                  }
                >
                  Copier le texte
                </Button>
                <p>
                  Relisez les faits et les ententes avant publication. Aucun
                  texte du site SPA n’a été modifié.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
