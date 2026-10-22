import { useEffect, useState } from "react";
import { Archive, CheckCheck } from "lucide-react";
import { api, imageUrl, speciesName, uid } from "./api.js";
import { prepareImages, AssetLoading } from "./asset-readiness.jsx";
import { Button, Modal, Spinner } from "./ui.jsx";
export function AnnualPicker({
  year,
  setYear,
  onCreate,
  disabled,
  notify,
  base,
  accent,
}) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState(null),
    [selected, setSelected] = useState([]),
    [style, setStyle] = useState("mosaic"),
    [onlyAdopted, setOnlyAdopted] = useState(false),
    [annualCount, setAnnualCount] = useState(""),
    [preparing, setPreparing] = useState(false),
    [progress, setProgress] = useState(null),
    [message, setMessage] = useState(`Bonne année ${Number(year) + 1}`),
    [messageSubtitle, setMessageSubtitle] = useState(
      "Merci aux familles, bénévoles et agents du refuge",
    );
  const hasPhoto = (a) => !!(a.cover_id || a.hasSourcePhoto);
  const source = (a, w) =>
    a.cover_id
      ? imageUrl(a.cover_id, w)
      : `/api/animals/${a.id}/source-photo?w=${w}`;
  useEffect(() => {
    setMessage(`Bonne année ${Number(year) + 1}`);
  }, [year]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(null);
    setAnnualCount("");
    api(`/video/year/${year}`)
      .then((d) => {
        if (active) {
          setData(d);
          setSelected(
            d.animals
              .filter(
                (a) => hasPhoto(a) && (!onlyAdopted || a.status === "adopted"),
              )
              .slice(0, 100)
              .map((a) => a.id),
          );
        }
      })
      .catch((e) => {
        if (active) {
          notify(e.message, "error");
          setOpen(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, year]);
  async function createMontage() {
    const chosen = data.animals.filter((a) => selected.includes(a.id));
    setPreparing(true);
    setProgress({ done: 0, total: chosen.length, failed: [] });
    const loaded = await prepareImages(
      chosen.map((a) => source(a, 1280)),
      { onProgress: setProgress },
    );
    setPreparing(false);
    if (loaded.failed.length) {
      notify(
        `${loaded.failed.length} photo(s) indisponible(s). Réessayez avant de créer le montage.`,
        "error",
      );
      return;
    }
    onCreate({
      ...base,
      template: "year",
      annualStyle: style,
      annualMessage: message,
      annualMessageSubtitle: messageSubtitle,
      annualSidePhotos: true,
      annualStats: true,
      annualAdoptionsOverride: annualCount === "" ? null : Number(annualCount),
      year,
      title: `${year} · L’année en images`,
      subtitle: "",
      outro: message || "Merci à toute l’équipe et aux familles.",
      accentColor: accent || base.accentColor,
      introSeconds: 1.5,
      outroSeconds: 8,
      clips: chosen.map((a) => ({
        id: uid(),
        kind: a.cover_id ? "photo" : "spa",
        ref: a.cover_id || a.id,
        seconds: 3,
        trim: 0,
        title: a.name,
        subtitle:
          a.status === "adopted"
            ? "Adoption enregistrée"
            : "Une histoire au refuge",
        caption: "",
        fit: "contain",
        muted: true,
      })),
    });
    setProgress(null);
    setOpen(false);
  }
  const rows = (data?.animals || []).filter(
    (a) => !onlyAdopted || a.status === "adopted",
  );
  return (
    <>
      <Button
        variant="secondary"
        icon={Archive}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Créer le bilan annuel
      </Button>
      {open && (
        <Modal
          wide
          title="Bilan de l’année"
          onClose={() => !preparing && setOpen(false)}
        >
          <div className="annual-options">
            <label>
              Année
              <select
                value={year}
                disabled={preparing}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from(
                  { length: new Date().getFullYear() - 1998 },
                  (_, i) => new Date().getFullYear() + 1 - i,
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Animation
              <select
                disabled={preparing}
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="mosaic">Portraits → logo SPA</option>
                <option value="slideshow">Diaporama classique</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                disabled={!data || preparing}
                checked={onlyAdopted}
                onChange={(e) => {
                  setOnlyAdopted(e.target.checked);
                  if (e.target.checked)
                    setSelected((v) =>
                      v.filter((id) =>
                        data.animals.some(
                          (a) => a.id === id && a.status === "adopted",
                        ),
                      ),
                    );
                }}
              />
              Uniquement les statuts adoptés
            </label>
          </div>
          <label className="annual-inline-total">
            <span>
              Nombre d’adoptions à afficher dans cette vidéo
              <small>
                Laissez vide pour utiliser les statistiques du refuge. Ce choix
                ne modifie pas les fiches ni les statistiques du site.
              </small>
            </span>
            <input
              type="number"
              min="0"
              max="1000000"
              placeholder="Automatique"
              value={annualCount}
              disabled={preparing}
              onChange={(e) => setAnnualCount(e.target.value)}
            />
          </label>
          {!data ? (
            <Spinner />
          ) : (
            <>
              <div className="annual-summary">
                <span>{selected.length}/100 animaux sélectionnés</span>
                <span>{data.adopted} adoptions observées dans l’année</span>
                <Button
                  variant="quiet"
                  icon={CheckCheck}
                  disabled={preparing}
                  onClick={() =>
                    setSelected(
                      rows
                        .filter(hasPhoto)
                        .slice(0, 100)
                        .map((a) => a.id),
                    )
                  }
                >
                  Tout sélectionner
                </Button>
                <Button
                  variant="quiet"
                  disabled={preparing}
                  onClick={() => setSelected([])}
                >
                  Désélectionner
                </Button>
              </div>
              <fieldset disabled={preparing} className="annual-animal-grid">
                {rows.map((a) => (
                  <label
                    key={a.id}
                    className={!hasPhoto(a) ? "unavailable" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      disabled={
                        !hasPhoto(a) ||
                        (!selected.includes(a.id) && selected.length >= 100)
                      }
                      onChange={() =>
                        setSelected((v) =>
                          v.includes(a.id)
                            ? v.filter((id) => id !== a.id)
                            : [...v, a.id],
                        )
                      }
                    />
                    {hasPhoto(a) ? (
                      <img src={source(a, 320)} alt="" />
                    ) : (
                      <span>Sans photo disponible</span>
                    )}
                    <strong>
                      {a.name}
                      <small>
                        {!a.cover_id && a.hasSourcePhoto ? "Photo SPA · " : ""}
                        {speciesName[a.species]} ·{" "}
                        {a.status === "adopted" ? "Adopté" : "Archivé"}
                      </small>
                    </strong>
                  </label>
                ))}
              </fieldset>
              {!rows.length && <p>Aucun animal pour cette année.</p>}
              <div className="annual-message-fields">
                <label>
                  Message de fin
                  <input
                    maxLength={120}
                    value={message}
                    disabled={preparing}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <label>
                  Sous-texte
                  <input
                    maxLength={180}
                    value={messageSubtitle}
                    disabled={preparing}
                    onChange={(e) => setMessageSubtitle(e.target.value)}
                  />
                </label>
              </div>
              {progress && (
                <AssetLoading state={{ ...progress, retry: createMontage }} />
              )}
              <div className="annual-create">
                <small>
                  Les animaux décochés ne figurent pas dans le montage. Les
                  statistiques gardent les observations de l’année complète.
                </small>
                <Button
                  disabled={
                    !selected.length ||
                    preparing ||
                    (annualCount !== "" &&
                      (!Number.isInteger(Number(annualCount)) ||
                        Number(annualCount) < 0 ||
                        Number(annualCount) > 1000000))
                  }
                  loading={preparing}
                  onClick={createMontage}
                >
                  {preparing ? "Préparation des photos…" : "Créer le montage"}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
