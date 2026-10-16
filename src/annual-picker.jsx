import { useEffect, useState } from "react";
import { Archive, CheckCheck } from "lucide-react";
import { api, imageUrl, speciesName, uid } from "./api.js";
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
    [onlyAdopted, setOnlyAdopted] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(null);
    api(`/video/year/${year}`)
      .then((d) => {
        if (active) {
          setData(d);
          setSelected(
            d.animals
              .filter(
                (a) => a.cover_id && (!onlyAdopted || a.status === "adopted"),
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
        <Modal wide title="Bilan de l’année" onClose={() => setOpen(false)}>
          <div className="annual-options">
            <label>
              Année
              <select
                value={year}
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
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="mosaic">Portraits → logo SPA</option>
                <option value="slideshow">Diaporama classique</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                disabled={!data}
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
                  onClick={() =>
                    setSelected(
                      rows
                        .filter((a) => a.cover_id)
                        .slice(0, 100)
                        .map((a) => a.id),
                    )
                  }
                >
                  Tout sélectionner
                </Button>
                <Button variant="quiet" onClick={() => setSelected([])}>
                  Désélectionner
                </Button>
              </div>
              <div className="annual-animal-grid">
                {rows.map((a) => (
                  <label
                    key={a.id}
                    className={!a.cover_id ? "unavailable" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      disabled={
                        !a.cover_id ||
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
                    {a.cover_id ? (
                      <img src={imageUrl(a.cover_id, 320)} alt="" />
                    ) : (
                      <span>Sans photo locale</span>
                    )}
                    <strong>
                      {a.name}
                      <small>
                        {speciesName[a.species]} ·{" "}
                        {a.status === "adopted" ? "Adopté" : "Archivé"}
                      </small>
                    </strong>
                  </label>
                ))}
              </div>
              {!rows.length && <p>Aucun animal pour cette année.</p>}
              <div className="annual-create">
                <small>
                  Les animaux décochés ne figurent pas dans le montage. Les
                  statistiques gardent les observations de l’année complète.
                </small>
                <Button
                  disabled={!selected.length}
                  onClick={() => {
                    const chosen = data.animals.filter((a) =>
                      selected.includes(a.id),
                    );
                    onCreate({
                      ...base,
                      template: "year",
                      annualStyle: style,
                      year,
                      title: `${year} · L’année en images`,
                      subtitle: "",
                      outro: "Merci à toute l’équipe et aux familles.",
                      accentColor: accent || base.accentColor,
                      introSeconds: 1.5,
                      outroSeconds: 8,
                      clips: chosen.map((a) => ({
                        id: uid(),
                        kind: "photo",
                        ref: a.cover_id,
                        seconds: 3,
                        trim: 0,
                        title: a.name,
                        subtitle:
                          a.status === "adopted"
                            ? "Adoption enregistrée"
                            : "Une histoire au refuge",
                        caption: "",
                        fit: "cover",
                        muted: true,
                      })),
                    });
                    setOpen(false);
                  }}
                >
                  Créer le montage
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
