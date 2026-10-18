export function animalCsv(rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@\-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const columns = [
    "Identifiant AniPic",
    "Identifiant SPA",
    "Nom",
    "Espèce",
    "Sexe",
    "Statut connu",
    "Origine de l’adoption",
    "Présence SPA",
    "Dernier inventaire",
    "Photos locales",
    "Dernières photos locales ajoutées",
    "Dernière modification fiche",
    "Archivage",
    "Fiche SPA",
  ];
  const species = { dog: "Chien", cat: "Chat", other: "NAC" };
  const statuses = {
    available: "À l’adoption",
    reserved: "Réservé",
    adopted: "Adopté",
    source_missing: "Absent de la source — adoption non confirmée",
  };
  return (
    "\uFEFF" +
    [
      columns,
      ...rows.map((a) => [
        a.id,
        a.source_id,
        a.name,
        species[a.species],
        a.sex === "male" ? "Mâle" : a.sex === "female" ? "Femelle" : "",
        statuses[a.status] || a.status,
        ["automatic_absence", "automatic_confirmed"].includes(
          a.adoption_origin?.kind,
        )
          ? "Règle automatique d’absence AniPic"
          : a.adoption_origin?.kind === "pending_review"
            ? "En attente de l’équipe · délai 24 h"
            : a.adoption_origin?.kind === "team_rejected"
              ? "Adoption écartée par l’équipe"
              : a.adoption_origin?.kind === "team_confirmed"
                ? "Adoption validée par l’équipe AniPic"
                : "",
        a.source_presence?.state === "missing"
          ? ["automatic_absence", "automatic_confirmed"].includes(
              a.adoption_origin?.kind,
            )
            ? "Absent — adoption automatique"
            : "Absent — à vérifier"
          : a.source_presence?.state === "present"
            ? "Présent"
            : "Non vérifiée",
        a.source_presence?.checkedAt,
        a.photo_count,
        a.latest_photo_at,
        a.updated_at,
        a.archived_at,
        a.source_url,
      ]),
    ]
      .map((r) => r.map(cell).join(";"))
      .join("\r\n") +
    "\r\n"
  );
}
