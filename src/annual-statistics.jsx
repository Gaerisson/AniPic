import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function AnnualStatistics({
  year = new Date().getFullYear(),
  user,
  notify,
  onSaved,
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    if (user)
      api("/annual-statistics/" + year)
        .then((d) => live && setData(d))
        .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [year, user?.id]);
  if (!user) return null;
  const canEdit = ["admin", "agent"].includes(user.role);
  return (
    <details className="annual-statistics feature-details">
      <summary>
        Adoptions {year} · {data?.count ?? "…"}{" "}
        {data && data.mode !== "auto" ? "(ajusté)" : ""}
      </summary>
      <div className="feature-body">
        <p>
          Complétez l’année de démarrage d’AniPic. Les autres années gardent
          leur calcul automatique.
        </p>
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            <p>
              <strong>{data.observed}</strong> adoption(s) enregistrée(s) dans
              AniPic pour {year}.
            </p>
            {canEdit ? (
              <>
                <label>
                  Calcul utilisé
                  <select
                    value={data.mode}
                    onChange={(e) => setData({ ...data, mode: e.target.value })}
                  >
                    <option value="auto">Statistiques AniPic</option>
                    <option value="complement">
                      Ajouter les adoptions antérieures
                    </option>
                    <option value="total">Définir le total annuel</option>
                  </select>
                </label>
                {data.mode !== "auto" && (
                  <label>
                    {data.mode === "total"
                      ? "Total annuel"
                      : "Adoptions antérieures à ajouter"}
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      value={data.value}
                      onChange={(e) =>
                        setData({
                          ...data,
                          value: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </label>
                )}
                <Button
                  disabled={busy}
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const saved = await api("/annual-statistics/" + year, {
                        method: "PUT",
                        body: { mode: data.mode, value: data.value },
                      });
                      setData(saved);
                      setError("");
                      notify?.("Bilan annuel enregistré.");
                      onSaved?.(saved);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Appliquer au bilan vidéo et à la TV
                </Button>
              </>
            ) : (
              <p>Total utilisé dans les créations : {data.count}.</p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
