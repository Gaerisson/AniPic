import { useEffect, useState } from "react";
import { api, apiBlob, imageUrl } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
export function PublicPosters({ notify }) {
  const [items, setItems] = useState(null),
    [chosen, setChosen] = useState([]),
    [query, setQuery] = useState(""),
    [template, setTemplate] = useState("spa"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      const rows = [];
      for (let page = 1; page <= 60; page++) {
        const d = await api("/animals?limit=60&page=" + page);
        rows.push(...d.items);
        if (page >= d.pages) break;
      }
      if (live) setItems(rows);
    })().catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div>
      <h1>Affiches de box</h1>
      <p>
        Choisissez les animaux : l’affiche utilise leurs portraits publics ou la
        photo du site SPA. Jusqu’à 20 fiches par téléchargement sans compte.
      </p>
      <div className="panel planning-toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un animal"
        />
        <select value={template} onChange={(e) => setTemplate(e.target.value)}>
          {["spa", "editorial", "glass", "contrast"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button
          disabled={busy || !chosen.length}
          onClick={async () => {
            setBusy(true);
            try {
              const blob = await apiBlob("/public/posters", {
                  animalIds: chosen,
                  template,
                }),
                url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "affiches-box.pdf";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
              notify("Affiches téléchargées.");
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Génération des affiches…"
            : "Télécharger " + chosen.length + " fiche(s)"}
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!items ? (
        <Spinner />
      ) : (
        <div className="public-poster-grid">
          {items
            .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
            .map((a) => (
              <label key={a.id} className="panel">
                <input
                  type="checkbox"
                  checked={chosen.includes(a.id)}
                  disabled={!chosen.includes(a.id) && chosen.length >= 20}
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? [...chosen, a.id]
                        : chosen.filter((x) => x !== a.id),
                    )
                  }
                />
                {a.public_cover_id ? (
                  <img alt={a.name} src={imageUrl(a.public_cover_id, 320)} />
                ) : (
                  <SpaPhoto animal={a} compact watermark={false} />
                )}
                <strong>{a.name}</strong>
              </label>
            ))}
        </div>
      )}
    </div>
  );
}
