import { useState } from "react";
import { Search, Download, ExternalLink } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function MusicCatalog({ canEdit, onImport, notify }) {
  const [query, setQuery] = useState("piano"),
    [tracks, setTracks] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="music-catalog">
      <summary>Trouver une musique en ligne</summary>
      <div className="music-provider-links">
        <a href="https://pixabay.com/music/" target="_blank" rel="noreferrer">
          Pixabay Music <ExternalLink size={12} />
        </a>
        <a
          href="https://www.facebook.com/sound/collection/"
          target="_blank"
          rel="noreferrer"
        >
          Meta Sound Collection <ExternalLink size={12} />
        </a>
      </div>
      <p>
        Import direct depuis Wikimedia Commons, avec auteur et licence
        conservés. Les catalogues sociaux s’ouvrent dans leur service.
      </p>
      <div className="music-search">
        <input
          value={query}
          maxLength="80"
          placeholder="Piano, instrumental…"
          aria-label="Rechercher une musique"
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          variant="secondary"
          icon={Search}
          disabled={busy || !query.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setTracks(
                (
                  await api(
                    `/video/music/search?q=${encodeURIComponent(query)}`,
                  )
                ).tracks,
              );
            } catch (e) {
              setError(e.message);
              setTracks(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          Rechercher
        </Button>
      </div>
      {busy && <p role="status">Recherche dans le catalogue…</p>}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {tracks?.length === 0 && (
        <p>
          Aucun MP3 importable pour cette recherche. Essayez un autre terme ou
          un catalogue ci-dessus.
        </p>
      )}
      {tracks?.map((track) => (
        <article key={track.id}>
          <div>
            <strong>{track.title}</strong>
            <small>
              {track.author} · {track.license}
            </small>
            <a href={track.source} target="_blank" rel="noreferrer">
              Écouter et voir la licence ↗
            </a>
          </div>
          <Button
            variant="secondary"
            icon={Download}
            disabled={!canEdit || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api("/video/music/import", {
                  method: "POST",
                  body: { pageId: track.id },
                });
                await onImport(result.id);
                notify("Musique importée, crédits conservés.");
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Importer
          </Button>
        </article>
      ))}
      <small>
        Pixabay : licence propre à chaque titre, éventuel Content ID. Pour les
        réseaux sociaux, vérifiez les plateformes autorisées sur la fiche du
        morceau.
      </small>
    </details>
  );
}
