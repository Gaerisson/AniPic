import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowUpRight } from "lucide-react";
import { api } from "./api.js";
import { NavLink } from "./nav-link.jsx";
export function SourceSyncAlert({ user, initial, onReview }) {
  const [health, setHealth] = useState(initial || null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    const refresh = () =>
      api("/source/health")
        .then((r) => {
          if (live) setHealth(r);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.id, initial]);
  if (!user || !health || ["ok", "disabled"].includes(health.state))
    return null;
  const mismatch = health.state === "mismatch";
  return (
    <section
      className="source-sync-alert"
      role="alert"
      aria-label="État de la synchronisation SPA"
    >
      <AlertTriangle size={23} />
      <div>
        <h2>
          {mismatch
            ? "Écart de synchronisation SPA"
            : health.state === "error"
              ? health.countsMatch
                ? "Effectifs concordants · dernier contrôle interrompu"
                : "Synchronisation SPA en échec"
              : health.state === "stale"
                ? "Synchronisation SPA à actualiser"
                : "Source SPA non vérifiée"}
        </h2>
        <p>
          {mismatch
            ? "Le nombre ou la liste d’animaux diffère du dernier inventaire SPA fiable."
            : health.state === "error"
              ? health.reason ||
                "Le dernier contrôle n’a pas confirmé un inventaire complet et fiable. Les fiches et les photos ont été conservées."
              : health.state === "stale"
                ? "Le dernier inventaire fiable est ancien : vérifiez la synchronisation avant de vous fier aux effectifs."
                : "Aucun inventaire complet n’a encore été comparé aux fiches locales."}
        </p>
        {health.sourceCount !== null && (
          <div className="source-sync-counts">
            <strong>{health.localCount} dans AniPic</strong>
            <span>↔</span>
            <strong>{health.sourceCount} dans l’inventaire SPA</strong>
          </div>
        )}
        {health.checkedAt && (
          <small>
            Dernier relevé fiable :{" "}
            {new Date(health.checkedAt).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
            })}
            {health.basedOn === "diagnostic"
              ? " · test sans mise à jour des fiches"
              : ""}
          </small>
        )}
        {health.state === "error" && health.lastAttemptAt && (
          <small>
            Dernière tentative :{" "}
            {new Date(health.lastAttemptAt).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
            })}{" "}
            · les fiches et les photos sont conservées.
          </small>
        )}
        <details className="source-sync-detail">
          <summary>Comprendre l’écart</summary>
          <p>
            {health.missingCount !== null
              ? `${health.missingCount} fiche(s) locale(s) non retrouvée(s) et ${health.newCount} fiche(s) reçue(s) non présentes dans la liste locale active. `
              : ""}
            Des fiches archivées volontairement peuvent aussi expliquer un
            écart.{" "}
            {health.canInferAdoption
              ? `La règle d’adoption automatique est activée : ${health.absencePolicy?.confirmations} confirmations, espacées d’au moins ${health.absencePolicy?.intervalHours} h, sont nécessaires. Les photos sont conservées.`
              : "L’adoption automatique est désactivée ; les absences restent à vérifier."}
          </p>
          {health.missing?.length > 0 && (
            <ul>
              {health.missing.map((a) => (
                <li key={a.id}>
                  {a.name} · {a.sourceId}
                </li>
              ))}
            </ul>
          )}
          {user.role !== "admin" && (
            <p>
              L’administration peut consulter le diagnostic et relancer la
              synchronisation.
            </p>
          )}
        </details>
      </div>
      <div className="source-sync-actions">
        {health.refreshing ? (
          <span role="status">
            <RefreshCw className="spin" size={15} /> Synchronisation en cours…
          </span>
        ) : user.role === "admin" ? (
          <NavLink className="button secondary" href="#sync">
            <RefreshCw size={15} /> Vérifier la synchronisation
          </NavLink>
        ) : null}
        {health.missingCount > 0 && onReview && (
          <button className="text-link" onClick={onReview}>
            Voir les fiches à vérifier <ArrowUpRight size={14} />
          </button>
        )}
      </div>
    </section>
  );
}
