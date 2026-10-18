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
        a.adoption_origin?.kind === "automatic_absence"
          ? "Règle automatique d’absence AniPic"
          : "",
        a.source_presence?.state === "missing"
          ? a.adoption_origin?.kind === "automatic_absence"
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
