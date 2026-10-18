import { Check, Undo2, X, LoaderCircle } from "lucide-react";
import { api } from "./api.js";
export async function decideAdoption(animalId, review, action) {
  return api(`/adoption-reviews/${animalId}/${action}`, {
    method: "POST",
    body: { expectedAt: review.at, expectedRevision: review.revision },
  });
}
export function AdoptionActions({ review, busy, onDecide }) {
  if (!review) return null;
  return (
    <div className="adoption-inline-actions" aria-busy={busy}>
      {review.canConfirm && (
        <button
          className="button"
          disabled={busy}
          onClick={() => onDecide("confirm")}
        >
          {busy ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Check size={14} />
          )}
          {review.state === "rejected" ? "Rétablir l’adoption" : "Oui, adopté"}
        </button>
      )}
      {review.canReject && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => onDecide("reject")}
        >
          {review.state === "confirmed" ? <Undo2 size={14} /> : <X size={14} />}
          {review.state === "confirmed" ? "Annuler l’adoption" : "Non"}
        </button>
      )}
      {review.state === "pending" && review.dueAt && (
        <small>
          Confirmation auto après le{" "}
          {new Date(review.dueAt).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      )}
    </div>
  );
}
