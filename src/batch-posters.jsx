import { useEffect, useState } from "react";
import {
  Printer,
  Download,
  LoaderCircle,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";
import { api, imageUrl, speciesName } from "./api.js";
import { Button, Empty, Spinner } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
export default function BatchPosters({ user, notify, go }) {
  const [animals, setAnimals] = useState(null),
    [chosen, setChosen] = useState([]),
    [query, setQuery] = useState(""),
    [species, setSpecies] = useState("all"),
    [template, setTemplate] = useState("spa"),
    [busy, setBusy] = useState(false),
    [job, setJob] = useState(null),
    [jobError, setJobError] = useState(""),
    [pollRetry, setPollRetry] = useState(0);
  const storageKey = "anipic-poster-export-" + user?.id;
  useEffect(() => {
    if (!user) return;
    try {
      const id = localStorage.getItem(storageKey);
      if (id) setJob({ id, state: "running", done: 0, total: 0 });
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    if (!job?.id || job.state !== "running") return;
    let active = true,
      timer;
    setBusy(true);
    const poll = async () => {
      try {
        const next = await api("/posters/exports/" + job.id);
        if (!active) return;
        setJob(next);
        setJobError("");
        if (next.state === "running") timer = setTimeout(poll, 1500);
        else {
          setBusy(false);
          if (next.state === "done")
            notify(
              `Export prêt : ${next.total - next.errors.length} fiches. Téléchargez le ZIP.`,
            );
        }
      } catch (e) {
        if (active) {
          setJobError(e.message);
          setBusy(false);
        }
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job?.id, job?.state, pollRetry]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      let items = [],
        page = 1,
        total = 1;
      while (items.length < total && page <= 35) {
        const d = await api(`/animals?sort=name&limit=60&page=${page++}`);
        items.push(...d.items);
        total = d.total;
      }
      if (active)
        setAnimals(
          items.filter((a) => a.cover_id || a.source_metadata?.thumbnail),
        );
    })().catch((e) => notify(e.message, "error"));
    return () => {
      active = false;
    };
  }, [user?.id]);
  if (!user)
    return (
      <Empty
        title="Affiches de box"
        text="Connectez-vous pour préparer les affiches."
      />
    );
  const filtered = (animals || []).filter(
    (a) =>
      (species === "all" || a.species === species) &&
      `${a.name} ${a.source_id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Affiches en série</h1>
          <p className="muted">
            PDF A4 regroupés dans un ZIP · jusqu’à 500 animaux
          </p>
        </div>
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => go("tools")}
        >
          Outils de l’équipe
        </Button>
      </div>
      <section className="panel batch-poster-options">
        <label>
          Modèle
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            {[
              ["spa", "SPA"],
              ["editorial", "Éditorial"],
              ["glass", "Liquid glass"],
              ["contrast", "Contraste"],
              ["custom", "Personnalisé"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recherche
          <input
            value={query}
            placeholder="Nom ou identifiant…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Espèce
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="all">Toutes</option>
            {Object.entries(speciesName).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Button
          icon={busy ? LoaderCircle : Printer}
          disabled={!chosen.length || busy}
          onClick={async () => {
            setBusy(true);
            setJobError("");
            try {
              const next = await api("/posters/exports", {
                method: "POST",
                body: { animalIds: chosen, template },
              });
              setJob(next);
              try {
                localStorage.setItem(storageKey, next.id);
              } catch {}
            } catch (e) {
              setJobError(e.message);
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Génération des pages…"
            : `Exporter ${chosen.length} affiche${chosen.length > 1 ? "s" : ""}`}
        </Button>
      </section>
      {(job || jobError) && (
        <section className="panel batch-export-status" aria-live="polite">
          {busy && <LoaderCircle className="spin" size={26} />}
          <h2>
            {job?.state === "done"
              ? "Vos fiches sont prêtes"
              : job?.state === "failed"
                ? "L’export n’a pas abouti"
                : "Préparation des fiches"}
          </h2>
          {job && (
            <>
              <progress max={job.total || 1} value={job.done || 0} />
              <p>
                {job.done || 0} / {job.total || "…"} fiches traitées ·{" "}
                {job.current}
              </p>
            </>
          )}
          {jobError && (
            <>
              <p role="alert">{jobError}</p>
              <Button
                variant="secondary"
                onClick={() => setPollRetry((v) => v + 1)}
              >
                Reprendre le suivi
              </Button>
            </>
          )}
          {job?.errors?.length > 0 && (
            <details>
              <summary>{job.errors.length} fiche(s) à réessayer</summary>
              {job.errors.map((e) => (
                <p key={e.animalId}>
                  {e.name} : {e.error}
                </p>
              ))}
            </details>
          )}
          {job?.download && (
            <>
              <a className="button" href={job.download}>
                <Download size={18} />
                Télécharger les fiches · ZIP
              </a>
              <p className="muted">
                {job.pdfs} PDF · téléchargement disponible pendant 24 heures.
              </p>
            </>
          )}
          {busy && (
            <p className="muted">
              Vous pouvez changer de page et revenir ici : l’export continue.
            </p>
          )}
        </section>
      )}
      <div className="batch-poster-toolbar">
        <span>
          {chosen.length} / {animals?.length || 0} sélectionnés
        </span>
        <Button
          variant="quiet"
          icon={CheckCheck}
          onClick={() =>
            setChosen(
              filtered.every((a) => chosen.includes(a.id))
                ? chosen.filter((id) => !filtered.some((a) => a.id === id))
                : [...new Set([...chosen, ...filtered.map((a) => a.id)])],
            )
          }
        >
          {filtered.length > 0 && filtered.every((a) => chosen.includes(a.id))
            ? "Désélectionner les résultats"
            : "Sélectionner tous les résultats"}
        </Button>
      </div>
      {!animals ? (
        <Spinner />
      ) : (
        <div className="batch-animal-grid">
          {filtered.map((a) => (
            <label
              key={a.id}
              className={chosen.includes(a.id) ? "selected" : ""}
            >
              <input
                type="checkbox"
                checked={chosen.includes(a.id)}
                onChange={(e) =>
                  setChosen((v) =>
                    e.target.checked
                      ? [...v, a.id]
                      : v.filter((id) => id !== a.id),
                  )
                }
              />
              <span>
                {a.cover_id ? (
                  <img src={imageUrl(a.cover_id, 320)} alt="" />
                ) : (
                  <SpaPhoto animal={a} compact />
                )}
              </span>
              <strong>
                {a.name}
                <small>
                  {speciesName[a.species]} ·{" "}
                  {a.cover_id ? "Photo locale" : "Photo SPA"}
                </small>
              </strong>
            </label>
          ))}
        </div>
      )}
    </>
  );
}
