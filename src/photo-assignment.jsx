import { useState, useEffect } from "react";
import {
  Camera,
  Search,
  Check,
  ArrowRight,
  LoaderCircle,
  ScanEye,
  RefreshCw,
} from "lucide-react";
import { api, speciesName, imageUrl } from "./api.js";
import { Button, Spinner, Modal } from "./ui.jsx";
import { AnimalStatus } from "./animal-status.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
const preview = (id, width = 640) => `/api/inbox/${id}/preview?width=${width}`;
export function PhotoAssignmentDialog({
  photos,
  close,
  notify,
  done,
  pushUndo,
  mode = "inbox",
  sourceAnimal,
}) {
  const reassign = mode === "reassign";
  const [suggestions, setSuggestions] = useState([]),
    [rememberFolder, setRememberFolder] = useState(false);
  useEffect(() => {
    if (reassign) return;
    api("/inbox/suggestions", {
      method: "POST",
      body: { photoIds: photos.map((p) => p.id) },
    })
      .then((r) => setSuggestions(r.items))
      .catch((e) => notify(e.message, "error"));
  }, []);
  const [query, setQuery] = useState(""),
    [species, setSpecies] = useState("all"),
    [animals, setAnimals] = useState(null),
    [chosen, setChosen] = useState(null),
    [hidden, setHidden] = useState(false),
    [busy, setBusy] = useState(false);
  const [visual, setVisual] = useState(null),
    [visualError, setVisualError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true,
      jobId,
      timer;
    setVisual(null);
    setVisualError("");
    const cancel = () =>
      jobId &&
      api(`/photos/assignment/suggestions/${jobId}`, {
        method: "DELETE",
      }).catch(() => {});
    async function update(job) {
      jobId = job.id;
      if (!alive) {
        cancel();
        return;
      }
      setVisual(job);
      if (job.state === "running")
        timer = setTimeout(async () => {
          try {
            await update(await api(`/photos/assignment/suggestions/${jobId}`));
          } catch (e) {
            if (alive) setVisualError(e.message);
          }
        }, 850);
    }
    api("/photos/assignment/suggestions", {
      method: "POST",
      body: {
        photoIds: photos.map((p) => p.id),
        mode,
        ...(reassign ? { sourceAnimalId: sourceAnimal.id } : {}),
      },
    })
      .then(update)
      .catch((e) => {
        if (alive) setVisualError(e.message);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
      cancel();
    };
  }, [attempt]);
  const visualLoading = !visualError && (!visual || visual.state === "running");
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () =>
        api(
          `/animals?limit=30&sort=name&species=${species}&q=${encodeURIComponent(query)}`,
        )
          .then((d) => {
            if (alive)
              setAnimals(d.items.filter((a) => a.id !== sourceAnimal?.id));
          })
          .catch((e) => notify(e.message, "error")),
      180,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, species]);
  return (
    <Modal
      title={`${reassign ? "Réattribuer" : "Attribuer"} ${photos.length} photo${photos.length > 1 ? "s" : ""}`}
      wide
      onClose={() => !busy && close()}
    >
      {reassign && (
        <p className="assignment-explanation">
          Ces photos sont actuellement chez{" "}
          <strong>{sourceAnimal?.name}</strong>. Choisissez leur bonne fiche ;
          légendes, originaux et confidentialité seront conservés.
        </p>
      )}
      <div className="assign-photo-strip">
        {photos.slice(0, 12).map((p) => (
          <img
            key={p.id}
            src={reassign ? imageUrl(p.id, 320) : preview(p.id, 160)}
            alt={p.filename}
          />
        ))}
        {photos.length > 12 && <span>+{photos.length - 12}</span>}
      </div>
      <section
        className="assignment-visual"
        aria-label="Suggestions de fiches par ressemblance"
        aria-busy={visualLoading}
      >
        <header>
          <div>
            <ScanEye size={20} />
            <h3>Ça ressemble à…</h3>
          </div>
          <button
            type="button"
            className="quiet"
            disabled={visualLoading || busy}
            onClick={() => setAttempt((v) => v + 1)}
            aria-label="Relancer la comparaison visuelle"
          >
            <RefreshCw size={15} /> Comparer
          </button>
        </header>
        <p className="small-note">
          Couleurs et contraste des photos locales et SPA. Suggestions
          indicatives : vérifiez le portrait avant d’attribuer.
          {visual?.selectedPhotos > 4
            ? " Pour ce lot, 4 photos réparties dans la sélection sont comparées. Si le lot mélange plusieurs animaux, attribuez-les séparément."
            : ""}
        </p>
        {visualLoading && (
          <div className="assignment-analysis" role="status">
            <LoaderCircle className="spin" size={16} />
            <span>
              Comparaison des portraits…{" "}
              {visual
                ? `${visual.checked} / ${visual.total} fiches`
                : "préparation"}
            </span>
          </div>
        )}
        {(visualError || visual?.error) && (
          <p role="status" className="small-note">
            {visualError || visual.error} La recherche par nom reste disponible.
          </p>
        )}
        <div className="assignment-visual-results">
          {(visual?.items || [])
            .filter((a) => species === "all" || a.species === species)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={chosen?.id === a.id}
                disabled={busy}
                onClick={() => setChosen(a)}
              >
                <span className="assignment-reference">
                  {a.source === "local" ? (
                    <img
                      src={imageUrl(a.referencePhotoId, 320)}
                      alt={`Portrait de ${a.name}`}
                    />
                  ) : (
                    <SpaPhoto animal={a} compact watermark={false} />
                  )}
                  <i>{a.source === "local" ? "Locale" : "SPA"}</i>
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {speciesName[a.species]} · {a.reason}
                  </small>
                  <code>{a.source_id || a.id.slice(0, 8)}</code>
                </span>
                {chosen?.id === a.id && <Check size={18} />}
              </button>
            ))}
        </div>
        {visual?.state === "done" && !visual.items.length && (
          <p className="small-note">
            Aucune ressemblance suffisante détectée. Recherchez la bonne fiche
            ci-dessous.
          </p>
        )}
        {visual?.state === "done" &&
          (visual.partial || visual.unavailable > 0) && (
            <p className="small-note">
              {visual.partial
                ? "Comparaison partielle : relancez pour compléter les photos SPA en cache. "
                : ""}
              {visual.unavailable > 0
                ? `${visual.unavailable} image(s) indisponible(s) ou illisible(s).`
                : ""}
            </p>
          )}
      </section>
      <div className="assign-search">
        {suggestions.length > 0 && (
          <section className="assign-suggestions">
            <h3>Suggestions d’après le dossier</h3>
            <div>
              {suggestions.map((a) => (
                <button
                  key={a.id}
                  className={chosen?.id === a.id ? "selected" : ""}
                  disabled={busy}
                  onClick={() => setChosen(a)}
                >
                  {a.cover_id ? (
                    <img src={imageUrl(a.cover_id, 320)} alt="" />
                  ) : a.hasSpaPhoto ? (
                    <span className="assign-animal-thumb">
                      <SpaPhoto animal={a} compact />
                      <i aria-hidden="true">SPA</i>
                    </span>
                  ) : (
                    <Camera size={24} />
                  )}
                  <span>
                    <strong>
                      {a.name} · {speciesName[a.species]}
                    </strong>
                    <code>{a.source_id || a.id.slice(0, 8)}</code>
                    <small>{a.reason}</small>
                  </span>
                  {chosen?.id === a.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </section>
        )}
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Rechercher l’animal destinataire"
            disabled={busy}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom ou identifiant SPA…"
          />
        </label>
        <select
          aria-label="Espèce de l’animal destinataire"
          disabled={busy}
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
        >
          <option value="all">Toutes les espèces</option>
          <option value="dog">Chiens</option>
          <option value="cat">Chats</option>
          <option value="other">NAC</option>
        </select>
      </div>
      <div className="assign-animals">
        {animals === null ? (
          <Spinner />
        ) : !animals.length ? (
          <p>Aucun animal ne correspond à la recherche.</p>
        ) : (
          animals.map((a) => (
            <button
              key={a.id}
              aria-pressed={chosen?.id === a.id}
              disabled={busy}
              onClick={() => setChosen(a)}
            >
              {a.cover_id ? (
                <img src={imageUrl(a.cover_id, 320)} alt="" />
              ) : a.source_metadata?.thumbnail ? (
                <span className="assign-animal-thumb">
                  <SpaPhoto animal={a} compact />
                  <i aria-hidden="true">SPA</i>
                </span>
              ) : (
                <span className="assign-placeholder">
                  <Camera size={23} />
                </span>
              )}
              <span>
                <strong>{a.name}</strong>
                <small>
                  {speciesName[a.species]} ·{" "}
                  {a.sex === "female"
                    ? "Femelle"
                    : a.sex === "male"
                      ? "Mâle"
                      : "Sexe non précisé"}
                </small>
                <code>{a.source_id || a.id.slice(0, 8)}</code>
              </span>
              <AnimalStatus animal={a} compact />
              {chosen?.id === a.id && <Check size={19} />}
            </button>
          ))
        )}
      </div>
      {!reassign && (
        <label className="checkbox-label inbox-private-choice">
          <input
            type="checkbox"
            checked={hidden}
            disabled={busy}
            onChange={(e) => setHidden(e.target.checked)}
          />
          Photos privées · comptes connectés uniquement
        </label>
      )}
      {!reassign && (
        <p className="small-note">
          {hidden
            ? "Les visiteurs non connectés ne verront pas ces photos."
            : "Après attribution, ces photos seront visibles dans la photothèque publique."}
        </p>
      )}
      {!reassign && photos.some((p) => p.folder) && (
        <label className="checkbox-label inbox-private-choice">
          <input
            type="checkbox"
            checked={rememberFolder}
            disabled={busy}
            onChange={(e) => setRememberFolder(e.target.checked)}
          />
          Suggérer cet animal pour les prochains exports dans ce dossier
        </label>
      )}
      <div className="assign-footer">
        <span>
          {chosen
            ? `${chosen.name} · ${chosen.source_id || chosen.id.slice(0, 8)}`
            : "Choisissez le bon animal avant de valider."}
        </span>
        <Button
          icon={busy ? LoaderCircle : ArrowRight}
          disabled={!chosen || busy || !photos.length}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await api(
                reassign ? "/photos/reassign" : "/inbox/assign",
                {
                  method: "POST",
                  body: {
                    photoIds: photos.map((p) => p.id),
                    animalId: chosen.id,
                    ...(reassign
                      ? { sourceAnimalId: sourceAnimal.id }
                      : { hidden, rememberFolder }),
                  },
                },
              );
              if (result.undoToken)
                pushUndo?.({
                  label: `${reassign ? "Réattribution" : "Attribution"} · ${photos.length} photo(s) · ${chosen.name}`,
                  successMessage: reassign
                    ? "Réattribution annulée. Les photos ont retrouvé leur fiche d’origine."
                    : "Attribution annulée. Les photos sont de nouveau dans Photos à trier.",
                  run: () =>
                    api("/photos/assignment/undo", {
                      method: "POST",
                      body: { token: result.undoToken },
                    }),
                });
              notify(
                reassign
                  ? `${result.moved} photo(s) réattribuée(s) à ${chosen.name}. Ctrl+Z pour annuler.`
                  : `${result.added} photo(s) attribuée(s) à ${chosen.name}${result.duplicates ? ` · ${result.duplicates} déjà présente(s)` : ""}.`,
              );
              done(chosen);
            } catch (e) {
              notify(e.message, "error");
              setBusy(false);
            }
          }}
        >
          {busy
            ? reassign
              ? "Réattribution…"
              : "Attribution…"
            : `${reassign ? "Réattribuer" : "Attribuer"}${chosen ? " à " + chosen.name : ""}`}
        </Button>
      </div>
    </Modal>
  );
}
