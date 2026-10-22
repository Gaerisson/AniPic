import { useState, useEffect } from "react";
import { Printer, Camera, ArrowLeft, Lock, CheckCheck } from "lucide-react";
import { api, speciesName, imageUrl } from "./api.js";
import { SpaPhoto } from "./spa-photo.jsx";
import { Button, Empty, Spinner } from "./ui.jsx";
export function ShootSheet({ user, notify, go }) {
  const [mode, setMode] = useState(
      () => sessionStorage.getItem("anipic-sheet-mode") || "priorities",
    ),
    [species, setSpecies] = useState("all"),
    [data, setData] = useState(null),
    [selected, setSelected] = useState([]),
    [date, setDate] = useState(() => new Date().toLocaleDateString("fr-CA")),
    [photographer, setPhotographer] = useState(""),
    [portraits, setPortraits] = useState(true),
    [search, setSearch] = useState("");
  useEffect(() => {
    document.documentElement.dataset.printPlan = "true";
    return () => {
      delete document.documentElement.dataset.printPlan;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    api(`/shoot-sheet?mode=${mode}&species=${species}`)
      .then((d) => {
        if (active) {
          setData(d);
          setSelected(mode === "custom" ? [] : d.items.map((a) => a.id));
        }
      })
      .catch((e) => notify(e.message, "error"));
    return () => {
      active = false;
    };
  }, [mode, species, user?.id]);
  if (!user)
    return (
      <Empty
        icon={Lock}
        title="Feuille de séance privée"
        text="Connectez-vous pour préparer la liste de l’équipe."
      />
    );
  const items = data?.items.filter((a) => selected.includes(a.id)) || [];
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <h1>Votre feuille de séance</h1>
          <p>
            Choisissez les animaux puis imprimez, ou enregistrez en PDF depuis
            la fenêtre d’impression.
          </p>
        </div>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => go("todo")}>
          Retour au planning
        </Button>
      </div>
      <section className="panel print-plan-controls no-print">
        <label>
          Liste
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="custom">Sélection libre · tous les animaux</option>
            <option value="all">Priorités + sans photo</option>
            <option value="priorities">Demandes de l’équipe</option>
            <option value="missing">Sans photo locale</option>
          </select>
        </label>
        <label>
          Espèce
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="all">Toutes</option>
            <option value="dog">Chiens</option>
            <option value="cat">Chats</option>
            <option value="other">NAC</option>
          </select>
        </label>
        <label>
          Date de séance
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Photographe
          <input
            value={photographer}
            onChange={(e) => setPhotographer(e.target.value)}
            maxLength={80}
            placeholder="Nom facultatif"
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={portraits}
            onChange={(e) => setPortraits(e.target.checked)}
          />
          Imprimer les portraits
        </label>
        <Button
          icon={Printer}
          disabled={!items.length}
          onClick={() => window.print()}
        >
          Imprimer / PDF · {items.length}
        </Button>
      </section>
      {data && (
        <details
          className="print-plan-picker no-print"
          open={mode === "custom"}
        >
          <summary>
            Choisir les animaux · {selected.length}/{data.items.length}
          </summary>
          <button
            className="filter-toggle"
            onClick={() =>
              setSelected(
                selected.length === data.items.length
                  ? []
                  : data.items.map((a) => a.id),
              )
            }
          >
            <CheckCheck size={15} /> Tout sélectionner / désélectionner
          </button>
          <label className="sheet-search">
            Rechercher un animal
            <input
              placeholder="Nom, espèce ou identifiant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div>
            {data.items
              .filter((a) =>
                `${a.name} ${speciesName[a.species]} ${a.source_id}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((a) => (
                <label key={a.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked
                          ? [...v, a.id]
                          : v.filter((id) => id !== a.id),
                      )
                    }
                  />
                  <span className="sheet-picker-photo">
                    {a.cover_id ? (
                      <img src={imageUrl(a.cover_id, 160)} alt="" />
                    ) : (
                      <SpaPhoto animal={a} compact />
                    )}
                  </span>
                  <strong>{a.name}</strong>
                  <span>
                    {speciesName[a.species]} · {a.source_id || a.id.slice(0, 8)}
                  </span>
                </label>
              ))}
          </div>
        </details>
      )}
      {!data ? (
        <Spinner />
      ) : (
        <article className="shoot-sheet">
          <header>
            <img className="sheet-spa-logo" src="/spa-logo.png" alt="La SPA" />
            <div>
              <small>{data.refuge}</small>
              <h2>Liste photo</h2>
              <p>
                {date
                  ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Date : __________________"}
                {photographer ? " · " + photographer : ""}
              </p>
            </div>
            <strong>
              {items.length} {items.length > 1 ? "animaux" : "animal"}
            </strong>
          </header>
          <p className="sheet-intro">Cochez les animaux photographiés.</p>
          {!items.length ? (
            <p>Aucun animal sélectionné.</p>
          ) : (
            items.map((a) => (
              <section
                className={`sheet-row ${portraits ? "" : "without-portraits"}`}
                key={a.id}
              >
                {portraits &&
                  (a.cover_id ? (
                    <img src={imageUrl(a.cover_id, 320)} alt="" />
                  ) : a.source_metadata?.thumbnail ? (
                    <span className="sheet-spa-photo">
                      <SpaPhoto animal={a} loading="eager" />
                    </span>
                  ) : (
                    <span className="sheet-no-photo">
                      <Camera size={24} />
                    </span>
                  ))}
                <div className="sheet-animal">
                  <h3>
                    {a.name} <small>{speciesName[a.species]}</small>
                  </h3>
                  <code>{a.source_id || a.id.slice(0, 8)}</code>
                  <span className="sheet-priority">
                    {
                      {
                        urgent: "Urgent",
                        high: "Priorité haute",
                        normal: a.photo_count
                          ? "Séance demandée"
                          : "Sans photo locale",
                        low: "Quand possible",
                      }[a.priority]
                    }
                  </span>
                  {a.requests.map((t) => (
                    <p key={t.id}>
                      <strong>{t.title}</strong>
                      {t.note ? " — " + t.note : ""}
                      {t.assignee ? " · " + t.assignee : ""}
                    </p>
                  ))}
                  <div className="sheet-writing">Notes :</div>
                </div>
                <div className="sheet-checks">
                  {["Photographié"].map((label) => (
                    <span key={label}>
                      <i />
                      {label}
                    </span>
                  ))}
                </div>
              </section>
            ))
          )}
          <footer>
            © Gaerisson · Anipic · Liste préparée le{" "}
            {new Date(data.generatedAt).toLocaleString("fr-FR")} · Espace équipe
          </footer>
        </article>
      )}
    </>
  );
}
