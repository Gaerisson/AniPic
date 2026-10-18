export async function registerArchiveFolders(app, { db }) {
  app.get("/api/archive/folders", async () => {
    const rows = db
        .prepare(
          "SELECT species,COALESCE(departed_at,archived_at) archived_at FROM animals WHERE archived_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||animals.id)",
        )
        .all(),
      groups = new Map();
    for (const r of rows) {
      const year = Number(String(r.archived_at).slice(0, 4));
      if (!Number.isInteger(year) || year < 1900 || year > 2200) continue;
      const key = r.species + ":" + year;
      groups.set(key, {
        species: r.species,
        year,
        count: (groups.get(key)?.count || 0) + 1,
      });
    }
    return [...groups.values()].sort(
      (a, b) => b.year - a.year || a.species.localeCompare(b.species),
    );
  });
}
