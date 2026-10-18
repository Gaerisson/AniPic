import { createContext, useContext } from "react";
import { date } from "./api.js";
import {
  statusDefaults,
  statusKeys,
  statusInk,
} from "../shared/animal-status.mjs";
export const StatusAppearanceContext = createContext(statusDefaults);
export function useStatusAppearance() {
  return useContext(StatusAppearanceContext) || statusDefaults;
}
export function AnimalStatus({
  animal,
  status = animal?.status,
  compact = false,
  appearance,
}) {
  const configured = useStatusAppearance();
  const sourceMissing =
    !animal?.archived_at && animal?.source_presence?.state === "missing";
  const value = statusKeys.includes(status) ? status : "unknown";
  const style = (appearance || configured)[value] || statusDefaults[value];
  const archived =
    animal?.archived_at &&
    !["adopted", "source_missing", "deceased", "transferred"].includes(value);
  const automatic =
    value === "adopted" &&
    animal?.adoption_origin?.kind === "automatic_absence";
  const teamConfirmed =
    value === "adopted" && animal?.adoption_origin?.kind === "team_confirmed";
  const label = sourceMissing
    ? "Absent de la liste SPA · à vérifier"
    : automatic
      ? "Adopté · automatique"
      : teamConfirmed
        ? "Adopté · confirmé par l’équipe"
        : archived
          ? "Archivé · statut à confirmer"
          : style?.label?.trim() ||
            statusDefaults[value]?.label ||
            "À confirmer";
  const color = sourceMissing
    ? "#e99436"
    : archived
      ? "#9fa6b2"
      : /^#[a-fA-F0-9]{6}$/.test(style?.color || "")
        ? style.color
        : statusDefaults[value]?.color || "#b4becb";
  const origin = sourceMissing
    ? `Absent du dernier inventaire complet appliqué${animal.source_presence.checkedAt ? " du " + date(animal.source_presence.checkedAt) : ""}. Dernier statut connu : ${style?.label || value}. Adoption non confirmée.`
    : automatic
      ? `Adoption déduite par la règle d’absence configurée dans AniPic, après ${animal.adoption_origin.confirmations} inventaires confirmés. Corrigée automatiquement si l’animal réapparaît.`
      : teamConfirmed
        ? `Adoption validée par l’équipe le ${date(animal.adoption_origin.reviewedAt)}. Corrigée si l’animal réapparaît dans l’inventaire SPA.`
        : animal?.source_id?.startsWith("demo:")
          ? "Profil de démonstration"
          : value === "source_missing"
            ? "Absence confirmée de l’inventaire ; adoption non confirmée"
            : animal?.source_id?.startsWith("spa:")
              ? "Statut importé de la source SPA"
              : "Statut importé du flux source";
  return (
    <span
      className={`animal-status status-${value} ${compact ? "compact" : ""}`}
      style={
        style && {
          "--status-color": color,
          "--status-ink-dark": statusInk(color),
          "--status-ink-light": statusInk(color, true),
        }
      }
      title={
        animal
          ? `${label} · ${origin}${animal.source_seen_at ? " · observé le " + date(animal.source_seen_at) : ""}`
          : label
      }
    >
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
export function StatusKey() {
  return (
    <details className="status-key">
      <summary>Couleurs des statuts</summary>
      <div>
        {statusKeys.map((status) => (
          <AnimalStatus key={status} status={status} />
        ))}
        <p>
          Les statuts proviennent de la source ou de la règle d’adoption
          automatique activée par l’administration. Les adoptions déduites sont
          signalées. L’archivage conserve les albums.
        </p>
      </div>
    </details>
  );
}
