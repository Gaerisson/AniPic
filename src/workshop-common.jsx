import { useState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "./api.js";
export function Progress({ job }) {
  if (!job) return null;
  return (
    <div
      className={`work-progress ${job.state}`}
      role={job.state === "failed" ? "alert" : "status"}
      aria-live="polite"
    >
      {job.state === "running" && <LoaderCircle size={21} className="spin" />}
      <span>
        <strong>{job.state === "failed" ? job.error : job.stage}</strong>
        {job.state === "running" && (
          <small>
            {job.progress != null
              ? `${job.progress} %`
              : `${job.done} / ${job.total}`}{" "}
            · Vous pouvez laisser cette page ouverte.
          </small>
        )}
      </span>
      {job.state === "running" && (
        <progress
          value={job.progress ?? job.done}
          max={job.progress != null ? 100 : job.total || 1}
        />
      )}
    </div>
  );
}
export function useJob(user, kind, notify) {
  const storageKey = `anipic-creative-${kind}-${user.id}`;
  const [job, setJob] = useState(null),
    [id, setId] = useState(() => {
      try {
        return sessionStorage.getItem(storageKey) || "";
      } catch {
        return "";
      }
    });
  useEffect(() => {
    if (!id) return;
    let stopped = false,
      timer;
    const poll = async () => {
      try {
        const result = await api(`/creative/jobs/${id}`);
        if (stopped) return;
        setJob(result);
        if (result.state === "running") timer = setTimeout(poll, 1000);
      } catch (e) {
        if (!stopped) {
          if (
            /introuvable|expiré|Connexion nécessaire|Accès réservé|Données invalides/.test(
              e.message,
            )
          ) {
            setJob(null);
            try {
              sessionStorage.removeItem(storageKey);
            } catch {}
            notify(e.message, "error");
          } else {
            setJob((previous) => ({
              ...(previous || {
                id,
                kind,
                state: "running",
                total: 1,
                done: 0,
              }),
              stage: "Connexion interrompue, reprise du suivi…",
            }));
            timer = setTimeout(poll, 4000);
          }
        }
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);
  const start = (result) => {
    try {
      sessionStorage.setItem(storageKey, result.id);
    } catch {}
    setJob(result);
    setId(result.id);
  };
  return [job, start];
}
export function WorkshopAnimalSearch({ onSelect, allAnimals = false }) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    let stop = false;
    const timer = setTimeout(
      () =>
        api(
          allAnimals
            ? `/creative/gazette/catalogue?q=${encodeURIComponent(query)}`
            : `/animals?q=${encodeURIComponent(query)}&limit=16`,
        )
          .then((d) => {
            if (!stop) {
              setItems(d.items);
              setError("");
            }
          })
          .catch((e) => {
            if (!stop) setError(e.message);
          }),
      200,
    );
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [query, allAnimals]);
  return (
    <div className="work-animal-search">
      <label>
        Choisir un animal
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Son nom ou identifiant SPA…"
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <div className="work-animal-results">
        {items.map((a) => (
          <button key={a.id} onClick={() => onSelect(a)}>
            <strong>{a.name}</strong>
            <small>
              {{ dog: "Chien", cat: "Chat", other: "NAC" }[a.species]} ·{" "}
              {a.archived ? "Archives" : a.source_id || "Fiche locale"}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
