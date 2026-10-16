import { useState, useEffect } from "react";
import { ScanSearch, EyeOff, ExternalLink } from "lucide-react";
import { api, bytes } from "./api.js";
import { Button } from "./ui.jsx";
export function SimilarPhotos({ notify, open }) {
  const [job, setJob] = useState(null),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [threshold, setThreshold] = useState(5),
    [error, setError] = useState("");
  useEffect(() => {
    if (!job) return;
    let live = true;
    const timer = setInterval(
      () =>
        api("/admin/jobs")
          .then((jobs) => {
            const item = jobs.find((j) => j.id === job);
            if (!live || !item || item.state === "running") return;
            if (item.state === "done") {
              setResult(JSON.parse(item.detail));
              setError("");
            } else setError(item.detail);
            setJob(null);
            setBusy(false);
          })
          .catch((e) => {
            if (live) {
              setError(e.message);
              setJob(null);
              setBusy(false);
            }
          }),
      1000,
    );
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [job]);
  return (
    <details className="feature-details panel similar-photos">
      <summary>
        <ScanSearch size={20} />
        <strong>Photos similaires</strong>
        <span>Comparaison visuelle</span>
      </summary>
      <div className="feature-body">
        <p>
          Repérez les exports ou cadrages proches. Les correspondances sont des
          suggestions ; aucune photo n’est supprimée.
        </p>
        <div className="feature-actions">
          <label>
            Sensibilité
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            >
              <option value={2}>Stricte</option>
              <option value={5}>Équilibrée</option>
              <option value={9}>Large</option>
            </select>
          </label>
          <Button
            icon={ScanSearch}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const j = await api("/admin/similar-photos", {
                  method: "POST",
                  body: { threshold },
                });
                setJob(j.id);
              } catch (e) {
                setBusy(false);
                setError(e.message);
              }
            }}
          >
            {busy ? "Analyse en cours…" : "Analyser les photos"}
          </Button>
        </div>
        {error && <p role="alert">{error}</p>}
        {result && (
          <>
            <small>
              {result.analysed} fichiers uniques analysés ·{" "}
              {result.items.length} rapprochements
              {result.limited ? " · limité aux 1 500 plus récents" : ""}
              {result.pairsLimited ? " · 100 résultats maximum" : ""}
              {result.errors
                ? ` · ${result.errors} fichier(s) illisible(s)`
                : ""}
            </small>
            <div className="similar-pairs">
              {result.items.map((pair) => (
                <article key={pair.key}>
                  <div>
                    {[pair.a, pair.b].map((side, i) => (
                      <figure key={i}>
                        <img
                          src={side.refs[0]?.preview}
                          alt={side.refs[0]?.filename}
                        />
                        <figcaption>
                          <strong>{side.refs[0]?.filename}</strong>
                          <small>
                            {side.refs
                              .map((r) => r.name || r.folder || "À trier")
                              .join(" · ")}{" "}
                            · {bytes(side.size)}
                          </small>
                          {side.refs[0]?.animal_id && (
                            <button
                              className="text-link"
                              onClick={() =>
                                open({
                                  type: "animal",
                                  id: side.refs[0].animal_id,
                                })
                              }
                            >
                              <ExternalLink size={14} />
                              Ouvrir la fiche
                            </button>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  <button
                    className="text-link"
                    onClick={async () => {
                      try {
                        await api("/admin/similar-photos/ignore", {
                          method: "POST",
                          body: { pair: pair.key },
                        });
                        setResult((r) => ({
                          ...r,
                          items: r.items.filter((p) => p.key !== pair.key),
                        }));
                      } catch (e) {
                        notify(e.message, "error");
                      }
                    }}
                  >
                    <EyeOff size={14} />
                    Ces photos sont différentes
                  </button>
                </article>
              ))}
            </div>
            {!result.items.length && (
              <p className="muted">
                Aucune correspondance avec cette sensibilité.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
