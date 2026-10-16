import { useState, useEffect } from "react";
import { History, ArrowRight, ExternalLink } from "lucide-react";
import { api, date } from "./api.js";
import { Spinner, Button, Empty } from "./ui.jsx";
const labels = {
  name: "Nom",
  species: "Espèce",
  sex: "Sexe",
  birth_date: "Naissance",
  description: "Présentation",
  breed: "Race",
  status: "Statut SPA",
  source_url: "Lien SPA",
  compatibility: "Ententes",
  tags: "Tags",
  source_metadata: "Informations complémentaires",
};
const value = (v) =>
  v == null
    ? "Non renseigné"
    : typeof v === "object"
      ? JSON.stringify(v, null, 2)
      : String(v);
export function AnimalHistory({ animalId, user, compact = false, open }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [baseline, setBaseline] = useState(false),
    [field, setField] = useState(""),
    [cursor, setCursor] = useState(0),
    [items, setItems] = useState([]);
  useEffect(() => {
    setCursor(0);
    setItems([]);
    setData(null);
  }, [animalId, baseline, field]);
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({
      limit: compact ? "20" : "40",
      after: String(cursor),
      baseline: baseline ? "1" : "0",
    });
    if (animalId) query.set("animalId", animalId);
    if (field) query.set("field", field);
    api((user ? "/changes?" : "/public/changes?") + query)
      .then((d) => {
        if (live) {
          setData(d);
          setItems((prev) => (cursor ? [...prev, ...d.items] : d.items));
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [animalId, user?.id, baseline, field, cursor]);
  const content = (
    <>
      <div className="history-toolbar">
        <select
          aria-label="Filtrer les changements SPA"
          value={field}
          onChange={(e) => setField(e.target.value)}
        >
          <option value="">Toutes les informations</option>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={baseline}
            onChange={(e) => setBaseline(e.target.checked)}
          />
          Inclure l’état initial
        </label>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <Spinner />
      ) : !items.length ? (
        <p className="muted">
          Aucun changement enregistré
          {data.trackingSince ? " depuis le " + date(data.trackingSince) : ""}.
        </p>
      ) : (
        <div className="animal-history-list">
          {items.map((r) => (
            <article key={r.seq}>
              <header>
                <span className="tag">
                  {r.kind === "baseline"
                    ? "État initial"
                    : r.kind === "added"
                      ? "Nouvelle fiche"
                      : r.kind === "missing"
                        ? "Absence confirmée"
                        : "Modification SPA"}
                </span>
                <time>{new Date(r.observed_at).toLocaleString("fr-FR")}</time>
              </header>
              {!animalId && (
                <button
                  className="history-animal"
                  onClick={() => open?.({ type: "animal", id: r.animal_id })}
                >
                  {r.name}
                  <small>{r.source_id}</small>
                </button>
              )}
              <strong>{labels[r.field] || r.field}</strong>
              <div className="history-values">
                {r.before !== null && <del>{value(r.before)}</del>}
                <span>{value(r.after)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
      {data?.next && (
        <Button variant="secondary" onClick={() => setCursor(data.next)}>
          Changements suivants
        </Button>
      )}
    </>
  );
  return compact ? (
    <details className="feature-details">
      <summary>
        <History size={17} />
        <strong>Historique SPA</strong>
      </summary>
      <div className="feature-body">{content}</div>
    </details>
  ) : (
    <div className="history-page">
      <div className="page-heading">
        <h1>Historique SPA</h1>
        <a
          className="button secondary"
          href="/api/public/changes"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          API publique
        </a>
      </div>
      <p className="fineprint">
        Chaque modification garde la valeur précédente et la nouvelle. L’état
        initial correspond à l’activation du suivi.
      </p>
      {content}
    </div>
  );
}
