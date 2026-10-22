import { useEffect, useState } from "react";
import {
  MessageCircle,
  Plus,
  CalendarDays,
  Vote,
  Copy,
  Send,
  Check,
} from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
const templates = {
  presence: {
    question: "Qui sera présent au refuge ?",
    options: "Matin\nAprès-midi\nJournée entière\nIndisponible",
    multiple: false,
  },
  mission: {
    question: "Qui participe à la prochaine collecte ?",
    options:
      "Installation\nCréneau du matin\nCréneau de l’après-midi\nRangement",
    multiple: true,
  },
  name: {
    question: "Quel prénom pour notre nouvel arrivant ?",
    options: "",
    multiple: false,
  },
  general: { question: "", options: "Oui\nNon\nÀ confirmer", multiple: false },
};
export default function TeamPolls({ user, go, open, notify }) {
  const [polls, setPolls] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [form, setForm] = useState(null),
    [votes, setVotes] = useState({});
  const manager = ["admin", "agent"].includes(user?.role);
  const load = () =>
    api("/team-polls")
      .then((d) => {
        setPolls(d.polls);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user?.id]);
  const act = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      notify?.(e.message, "error");
    } finally {
      setBusy("");
    }
  };
  if (!user)
    return (
      <Empty
        icon={Vote}
        title="Les sondages de votre équipe"
        text="Connectez-vous pour voter et retrouver les réponses du refuge."
        action={
          <Button onClick={() => open({ type: "login", then: "polls" })}>
            Se connecter
          </Button>
        }
      />
    );
  return (
    <div className="team-polls">
      <header className="page-heading">
        <div>
          <span className="eyebrow">UNE ÉQUIPE, DES RÉPONSES CLAIRES</span>
          <h1>Sondages du refuge</h1>
          <p>
            Présences, collectes ou choix de prénom : votez ici, partagez le
            lien dans votre communauté WhatsApp.
          </p>
        </div>
        {manager && (
          <Button
            onClick={() =>
              setForm({
                kind: "presence",
                ...templates.presence,
                opensAt: "",
                closesAt: "",
              })
            }
          >
            <Plus size={18} />
            Nouveau sondage
          </Button>
        )}
      </header>
      <div className="poll-links">
        <Button variant="secondary" onClick={() => go("volunteers")}>
          <CalendarDays size={17} />
          Présences & missions
        </Button>
        <span>
          Le partage ouvre WhatsApp. AniPic n’envoie aucun message
          automatiquement dans vos groupes.
        </span>
      </div>
      {form && (
        <form
          className="panel poll-form"
          onSubmit={(e) => {
            e.preventDefault();
            act("create", async () => {
              await api("/team-polls", {
                method: "POST",
                body: {
                  kind: form.kind,
                  question: form.question,
                  options: form.options
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  multiple: form.multiple,
                  ...(form.opensAt
                    ? { opensAt: new Date(form.opensAt).toISOString() }
                    : {}),
                  ...(form.closesAt
                    ? { closesAt: new Date(form.closesAt).toISOString() }
                    : {}),
                },
              });
              setForm(null);
              notify("Sondage prêt à partager.");
            });
          }}
        >
          <h2>Préparer un sondage</h2>
          <label>
            Modèle
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value,
                  ...templates[e.target.value],
                })
              }
            >
              <option value="presence">Présence au refuge</option>
              <option value="mission">Collecte / mission</option>
              <option value="name">Choix d’un prénom</option>
              <option value="general">Question libre</option>
            </select>
          </label>
          <label>
            Question
            <input
              required
              maxLength={240}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </label>
          <label>
            Réponses · une par ligne
            <textarea
              required
              rows={5}
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              Ouverture programmée
              <input
                type="datetime-local"
                value={form.opensAt}
                onChange={(e) => setForm({ ...form, opensAt: e.target.value })}
              />
            </label>
            <label>
              Clôture
              <input
                type="datetime-local"
                value={form.closesAt}
                onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.multiple}
              onChange={(e) => setForm({ ...form, multiple: e.target.checked })}
            />
            Plusieurs réponses autorisées
          </label>
          <div className="form-row">
            <Button type="submit" disabled={!!busy} loading={busy === "create"}>
              Créer le sondage
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Annuler
            </Button>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {!polls && !error ? (
        <Spinner />
      ) : polls?.length === 0 ? (
        <Empty
          icon={Vote}
          title="Votre premier sondage"
          text="Un agent peut préparer une question et programmer son ouverture."
        />
      ) : (
        <div className="poll-list">
          {polls?.map((p) => {
            const selected = votes[p.id] ?? p.mine,
              closed = p.state !== "open",
              link = location.origin + location.pathname + "#polls",
              text =
                p.question +
                "\n" +
                p.options.map((x, i) => `${i + 1}. ${x}`).join("\n") +
                "\n\nRépondre dans AniPic : " +
                link;
            return (
              <article
                className="panel poll-card"
                id={"poll-" + p.id}
                key={p.id}
              >
                <header>
                  <span className={"tag " + p.state}>
                    {p.state === "open"
                      ? "Vote ouvert"
                      : p.state === "scheduled"
                        ? "Programmé"
                        : "Clôturé"}
                  </span>
                  <time>
                    {new Date(p.closesAt).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </header>
                <h2>{p.question}</h2>
                {p.state === "scheduled" && (
                  <p>
                    Ouverture le {new Date(p.opensAt).toLocaleString("fr-FR")}.
                  </p>
                )}
                <div className="poll-options">
                  {p.results.map((r, i) => (
                    <label
                      className={selected.includes(i) ? "selected" : ""}
                      key={i}
                    >
                      <input
                        type={p.multiple ? "checkbox" : "radio"}
                        name={p.id}
                        disabled={closed || !!busy}
                        checked={selected.includes(i)}
                        onChange={() =>
                          setVotes({
                            ...votes,
                            [p.id]: p.multiple
                              ? selected.includes(i)
                                ? selected.filter((x) => x !== i)
                                : [...selected, i]
                              : [i],
                          })
                        }
                      />
                      <span>
                        {r.option}
                        <i
                          style={{
                            width:
                              (p.participants
                                ? (r.count / p.participants) * 100
                                : 0) + "%",
                          }}
                        />
                      </span>
                      <b>{r.count}</b>
                    </label>
                  ))}
                </div>
                <div className="poll-actions">
                  <small>
                    {p.participants} participant(s) ·{" "}
                    {p.multiple ? "Choix multiples" : "Un seul choix"}
                  </small>
                  {!closed && (
                    <Button
                      disabled={!!busy}
                      loading={busy === p.id}
                      onClick={() =>
                        act(p.id, () =>
                          api("/team-polls/" + p.id + "/vote", {
                            method: "POST",
                            body: { choices: selected },
                          }),
                        )
                      }
                    >
                      <Check size={16} />
                      {p.mine.length ? "Modifier mon vote" : "Valider mon vote"}
                    </Button>
                  )}
                  <a
                    className="button secondary"
                    href={"https://wa.me/?text=" + encodeURIComponent(text)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={16} />
                    Partager
                  </a>
                  <Button
                    variant="ghost"
                    aria-label="Copier le sondage"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(text)
                        .then(() => notify("Lien et question copiés."))
                        .catch(() =>
                          notify("La copie est indisponible.", "error"),
                        )
                    }
                  >
                    <Copy size={16} />
                  </Button>
                  {manager && p.state !== "closed" && (
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() =>
                        act(p.id, () =>
                          api("/team-polls/" + p.id + "/close", {
                            method: "POST",
                            body: {},
                          }),
                        )
                      }
                    >
                      Clôturer
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
