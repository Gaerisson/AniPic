import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import { photoDateLabel } from "../shared/photo-freshness.mjs";
export function PhotoUpdate({ animal: a, user }) {
  const ref = useRef(),
    [result, setResult] = useState(a.sourcePhotoMatch || null),
    [busy, setBusy] = useState(false);
  const compare = () => {
    if (busy) return;
    setBusy(true);
    api(`/animals/${a.id}/source-match`, { method: "POST", body: {} })
      .then(setResult)
      .catch(() => setResult({ status: "unavailable" }))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    setResult(a.sourcePhotoMatch || null);
    if (
      !user ||
      !a.cover_id ||
      !a.source_metadata?.thumbnail ||
      (a.sourcePhotoMatch && !a.sourcePhotoMatch.stale)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          observer.disconnect();
          compare();
        }
      },
      { rootMargin: "50px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [a.id, a.latest_photo_at, user?.id, a.source_metadata?.thumbnail]);
  const date = a.latest_photo_at ? new Date(a.latest_photo_at) : null,
    label = photoDateLabel(a.latest_photo_at);
  const labels = {
      probable_match: "Repérée sur la SPA",
      not_detected: "Non repérée sur la SPA",
      review: "Comparaison à vérifier",
      unavailable: "Comparaison indisponible",
    },
    status = result?.stale ? "review" : result?.status;
  return (
    <div className="photo-update-info" ref={ref}>
      {label && (
        <time
          dateTime={a.latest_photo_at}
          title={`Dernières photos ajoutées le ${date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`}
        >
          Photos · <strong>{label}</strong>
        </time>
      )}
      {user && a.cover_id && (
        <button
          className={`source-match match-${status || "pending"}`}
          disabled={busy || !a.source_metadata?.thumbnail}
          title={
            !a.source_metadata?.thumbnail
              ? "Aucune photo principale SPA fournie pour cette fiche. Lancez une synchronisation pour actualiser la référence."
              : `Comparaison indicative avec la photo principale SPA, actualisée quotidiennement. Un recadrage peut empêcher la reconnaissance.${result?.checkedAt ? " Vérifiée le " + new Date(result.checkedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) + "." : ""}`
          }
          onClick={compare}
        >
          <i aria-hidden="true" />
          {!a.source_metadata?.thumbnail
            ? "Référence SPA absente"
            : busy
              ? "Comparaison SPA…"
              : labels[status] || "Vérifier la photo SPA"}
        </button>
      )}
    </div>
  );
}
