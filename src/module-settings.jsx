import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { moduleCatalog } from "../shared/modules.mjs";
export default function ModuleSettings({ notify, reload }) {
  const [d, setD] = useState(null),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/modules")
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);
  if (!d) return error ? <p role="alert">{error}</p> : <Spinner />;
  return (
    <div className="module-settings">
      <h1>
        Fonctions du site<span className="heading-dot">.</span>
      </h1>
      <p>
        Un module désactivé disparaît des menus et ses API refusent les
        opérations. Les fichiers et les projets existants sont conservés.
      </p>
      <div className="module-filter">
        <label>
          Rechercher une fonction
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Registre, vidéo, planning…"
          />
        </label>
        <strong>
          {moduleCatalog.filter((m) => d.modules[m.id] !== false).length} /{" "}
          {moduleCatalog.length} activées
        </strong>
      </div>
      <div className="module-grid">
        {moduleCatalog
          .filter((m) =>
            (m.name + " " + m.description)
              .toLocaleLowerCase("fr")
              .includes(query.toLocaleLowerCase("fr")),
          )
          .map((m) => (
            <label className="panel module-switch" key={m.id}>
              <span>
                <strong>{m.name}</strong>
                <small>{m.description}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={d.modules[m.id]}
                onChange={(e) =>
                  setD({
                    ...d,
                    modules: { ...d.modules, [m.id]: e.target.checked },
                  })
                }
              />
            </label>
          ))}
      </div>
      <label className="panel module-switch">
        <span>
          <strong>Affiches accessibles sans compte</strong>
          <small>
            Photos publiques et photos SPA uniquement. Le PIN du refuge reste
            appliqué.
          </small>
        </span>
        <input
          type="checkbox"
          checked={d.publicPosters}
          onChange={(e) => setD({ ...d, publicPosters: e.target.checked })}
        />
      </label>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/admin/modules", { method: "PUT", body: d });
            notify("Modules enregistrés.");
            reload();
            window.dispatchEvent(new Event("anipic-modules"));
          } catch (e) {
            notify(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Enregistrement…" : "Enregistrer les modules"}
      </Button>
    </div>
  );
}
