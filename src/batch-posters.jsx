import { useEffect, useState } from "react";
import { Printer, Search, CheckCheck, ArrowLeft } from "lucide-react";
import { api, apiDownload, imageUrl, speciesName } from "./api.js";
import { Button, Empty, Spinner } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
export default function BatchPosters({ user, notify, go }) {
  const [animals, setAnimals] = useState(null),
    [chosen, setChosen] = useState([]),
    [query, setQuery] = useState(""),
    [species, setSpecies] = useState("all"),
    [template, setTemplate] = useState("spa"),
    [busy, setBusy] = useState(false);
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
            Tous les animaux sélectionnés · PDF A4 en lots de 20 pages
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
          icon={Printer}
          disabled={!chosen.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const pages = [];
              for (let i = 0; i < chosen.length; i += 20)
                pages.push(chosen.slice(i, i + 20));
              // Each request remains bounded; browsers may ask to allow multiple downloads.
              for (const [index, animalIds] of pages.entries())
                await apiDownload(
                  "/posters/batch",
                  { animalIds, template },
                  pages.length === 1
                    ? "affiches-box-SPA.pdf"
                    : `affiches-box-SPA-${index + 1}-sur-${pages.length}.pdf`,
                );
              notify("PDF des affichettes prêt.");
            } catch (e) {
              notify(e.message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Génération des pages…"
            : `Exporter ${chosen.length} affiche${chosen.length > 1 ? "s" : ""}`}
        </Button>
      </section>
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
