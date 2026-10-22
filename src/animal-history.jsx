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
import {
  historyGroups,
  historyValue as value,
} from "../shared/history-groups.mjs";
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
      limit: "100",
      order: "desc",
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
          {historyGroups(items).map((group) => (
            <article className="history-group" key={group.key}>
              <header>
                <div>
                  <span className="tag">
                    {group.kind === "baseline"
                      ? "État initial"
                      : group.kind === "added"
                        ? "Nouvelle fiche"
                        : group.kind === "missing"
                          ? "Absence confirmée"
                          : "Fiche actualisée"}
                  </span>
                  <small>{group.changes.length} information(s)</small>
                </div>
                <time>
                  {new Date(group.observed_at).toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </header>
              {!animalId && (
                <button
                  className="history-animal"
                  onClick={() =>
                    open?.({ type: "animal", id: group.animal_id })
                  }
                >
                  <strong>{group.name}</strong>
                  <small>{group.source_id}</small>
                  <ArrowRight size={18} />
                </button>
              )}
              <div className="history-change-rows">
                {group.changes.map((r) => (
                  <div
                    key={r.seq}
                    className={
                      "history-change-row " +
                      (r.before === null ? "initial" : "")
                    }
                  >
                    <strong>{labels[r.field] || r.field}</strong>
                    <div className="history-values">
                      {r.before !== null && (
                        <>
                          <del>{value(r.before, r.field)}</del>
                          <ArrowRight size={16} />
                        </>
                      )}
                      <span>{value(r.after, r.field)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {data?.next && (
        <Button variant="secondary" onClick={() => setCursor(data.next)}>
          Afficher les changements plus anciens
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
        Les changements sont regroupés par animal et par synchronisation, du
        plus récent au plus ancien. Comparez les anciennes et les nouvelles
        informations.
      </p>
      {content}
    </div>
  );
}
