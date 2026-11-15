import { useState, useEffect, useRef } from "react";
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
import "./inbox318.css";
const preview = (id, width = 640) => `/api/inbox/${id}/preview?width=${width}`;
export function LargeAssignmentPhoto({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  return failed ? (
    <div className="assignment-photo-error" role="status">
      <Camera size={28} />
      <p>Photo temporairement indisponible.</p>
      <Button
        variant="secondary"
        onClick={() => {
          setAttempt((v) => v + 1);
          setFailed(false);
        }}
      >
        Réessayer
      </Button>
    </div>
  ) : (
    <img
      className={className}
      src={src + (attempt ? `&retry=${attempt}` : "")}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
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
  const [inspection, setInspection] = useState(null);
  const inspectionRef = useRef();
  const inspect = (candidate, photoIndex = 0) =>
    setInspection({ candidate, photoIndex });
  const moveSource = (delta) =>
    setInspection((current) => ({
      ...current,
      photoIndex: Math.max(
        0,
        Math.min(photos.length - 1, current.photoIndex + delta),
      ),
    }));
  useEffect(() => {
    if (!inspection) return;
    const previous = document.activeElement;
    inspectionRef.current?.focus();
    return () => previous?.focus();
  }, [!!inspection]);
  useEffect(() => {
    if (!inspection) return;
    const keydown = (event) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveSource(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [!!inspection, photos.length]);
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
  const candidate = inspection?.candidate;
  const referenceId =
    candidate?.source === "local"
      ? candidate.referencePhotoId
      : candidate?.source === "spa"
        ? null
        : candidate?.cover_id;
  const referenceSpa =
    candidate?.source === "spa" ||
    candidate?.hasSpaPhoto ||
    candidate?.source_metadata?.thumbnail;
  const inspectedPhoto = inspection && photos[inspection.photoIndex];
  return (
    <Modal
      title={
        inspection
          ? "Comparer les portraits"
          : `${reassign ? "Réattribuer" : "Attribuer"} ${photos.length} photo${photos.length > 1 ? "s" : ""}`
      }
      wide
      className="photo-assignment-dialog"
      onClose={() => {
        if (!busy) inspection ? setInspection(null) : close();
      }}
    >
      {inspection && inspectedPhoto && (
        <section
          className="assignment-comparison"
          ref={inspectionRef}
          tabIndex={-1}
          aria-label="Comparaison en grand"
        >
          <div className="assignment-comparison-pair">
            <figure>
              <figcaption>
                <strong>
                  Photo à {reassign ? "réattribuer" : "attribuer"}
                </strong>
                <span>{inspectedPhoto.filename}</span>
              </figcaption>
              <div className="assignment-comparison-image">
                <LargeAssignmentPhoto
                  key={inspectedPhoto.id}
                  src={
                    reassign
                      ? imageUrl(inspectedPhoto.id, 1280)
                      : preview(inspectedPhoto.id, 1600)
                  }
                  alt={inspectedPhoto.filename}
                />
              </div>
              <div className="inbox-view-controls">
                <Button
                  variant="secondary"
                  disabled={inspection.photoIndex === 0}
                  onClick={() => moveSource(-1)}
                >
                  Précédente
                </Button>
                <span aria-live="polite">
                  {inspection.photoIndex + 1} / {photos.length}
                </span>
                <Button
                  variant="secondary"
                  disabled={inspection.photoIndex >= photos.length - 1}
                  onClick={() => moveSource(1)}
                >
                  Suivante
                </Button>
              </div>
            </figure>
            <figure>
              <figcaption>
                <strong>{candidate?.name || "Référence à comparer"}</strong>
                {candidate && (
                  <span>
                    {speciesName[candidate.species]} ·{" "}
                    {candidate.source_id || candidate.id.slice(0, 8)}
                  </span>
                )}
              </figcaption>
              <div className="assignment-comparison-image">
                {referenceId ? (
                  <LargeAssignmentPhoto
                    key={referenceId}
                    src={imageUrl(referenceId, 1280)}
                    alt={`Portrait local de ${candidate.name}`}
                  />
                ) : referenceSpa ? (
                  <SpaPhoto animal={candidate} large loading="eager" />
                ) : (
                  <p>
                    {candidate
                      ? "Cette fiche n’a pas de photo de référence."
                      : "Revenez aux suggestions pour ouvrir un portrait à comparer."}
                  </p>
                )}
              </div>
              {candidate && (
                <p className="small-note">
                  {referenceId
                    ? "Photo locale"
                    : referenceSpa
                      ? "Photo du site SPA"
                      : "Sans photo"}
                  {candidate.reason ? ` · ${candidate.reason}` : ""}
                </p>
              )}
            </figure>
          </div>
          <p className="small-note">
            Vérifiez le portrait et l’identifiant. Le choix ci-dessous prépare
            l’attribution ; vous la validerez ensuite pour les {photos.length}{" "}
            photo(s) sélectionnées. Flèches : parcourir les sources · Échap :
            revenir.
          </p>
          <div className="assignment-comparison-actions">
            <Button variant="secondary" onClick={() => setInspection(null)}>
              Revenir aux suggestions
            </Button>
            {candidate && (
              <Button
                icon={Check}
                onClick={() => {
                  setChosen(candidate);
                  setInspection(null);
                }}
              >
                Choisir {candidate.name}
              </Button>
            )}
          </div>
        </section>
      )}
      <div hidden={!!inspection}>
        {reassign && (
          <p className="assignment-explanation">
            Ces photos sont actuellement chez{" "}
            <strong>{sourceAnimal?.name}</strong>. Choisissez leur bonne fiche ;
            légendes, originaux et confidentialité seront conservés.
          </p>
        )}
        <div className="assign-photo-strip">
          {photos.map((p, index) => (
            <button
              type="button"
              key={p.id}
              disabled={busy}
              aria-label={`Agrandir ${p.filename}`}
              onClick={() => inspect(chosen, index)}
            >
              <img
                key={p.id}
                src={reassign ? imageUrl(p.id, 320) : preview(p.id, 160)}
                alt={p.filename}
                loading="lazy"
              />
            </button>
          ))}
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
            indicatives : ouvrez un portrait pour le comparer en grand avant de
            choisir.
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
              {visualError || visual.error} La recherche par nom reste
              disponible.
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
                  aria-label={`Comparer en grand avec ${a.name} · ${a.source_id || a.id.slice(0, 8)}`}
                  onClick={() => inspect(a)}
                >
                  <span className="assignment-reference">
                    {a.source === "local" ? (
                      <img
                        src={imageUrl(a.referencePhotoId, 320)}
                        alt={`Portrait de ${a.name}`}
                        loading="lazy"
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
                    aria-label={`Comparer en grand avec ${a.name} · ${a.source_id || a.id.slice(0, 8)}`}
                    onClick={() => inspect(a)}
                  >
                    {a.cover_id ? (
                      <img
                        src={imageUrl(a.cover_id, 320)}
                        alt=""
                        loading="lazy"
                      />
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
                aria-label={`Comparer en grand avec ${a.name} · ${a.source_id || a.id.slice(0, 8)}`}
                onClick={() => inspect(a)}
              >
                {a.cover_id ? (
                  <img src={imageUrl(a.cover_id, 320)} alt="" loading="lazy" />
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
      </div>
    </Modal>
  );
}
