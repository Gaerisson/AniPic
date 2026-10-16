import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { config, root } from "../server/config.mjs";
import { openDb, id, saveSettings, now, feedEvent } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
import { createUser } from "../server/auth.mjs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
export async function seed(db, c) {
  if (db.prepare("SELECT id FROM animals LIMIT 1").get())
    throw new Error("La démonstration nécessite une base vide.");
  const animals = [
    ["Nala", "dog", "female", "nala", false],
    ["Maya", "cat", "female", "maya", false],
    ["Rio", "dog", "male", "rio", false],
    ["Plume", "cat", "female", "plume", false],
    ["Oscar", "dog", "male", "oscar", false],
    ["Cookie", "other", "male", "cookie", false],
    ["Milo", "dog", "male", "milo", false],
    ["Simba", "cat", "male", "simba", false],
    ["Luna", "cat", "female", "luna", true],
    ["Baltic", "dog", "male", "baltic", true],
    ["Nala", "cat", "female", null, false],
    ["Paco", "dog", "male", null, false],
    ["Nougat", "other", "male", null, false],
    ["Suki", "cat", "female", null, false],
  ];
  const created = [];
  for (const [index, a] of animals.entries()) {
    const animalId = id();
    const date = new Date(Date.now() - index * 86400_000).toISOString();
    db.prepare(
      "INSERT INTO animals(id,name,species,sex,birth_date,description,status,archived_at,source_id,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      animalId,
      a[0],
      a[1],
      a[2],
      `${2022 + (index % 3)}-04-15`,
      `Fiche de démonstration. ${a[0]} adore explorer, jouer et partager des moments complices. Ce profil et son statut sont fictifs; la photographie illustre uniquement l’interface.`,
      a[4] ? "adopted" : "available",
      a[4] ? date : null,
      `demo:${index + 1}`,
      JSON.stringify(
        index === 0 ? ["Coup de cœur"] : index === 3 ? ["À découvrir"] : [],
      ),
      date,
      date,
    );
    if (a[3]) {
      const filename = path.join(root, "demo", "images", a[3] + ".jpg");
      if (existsSync(filename)) {
        const p = await ingest(
          db,
          c,
          animalId,
          createReadStream(filename),
          a[3] + ".jpg",
        );
        db.prepare("UPDATE photos SET created_at=? WHERE id=?").run(date, p.id);
        created.push(p.id);
      }
    }
    db.prepare("UPDATE animals SET updated_at=? WHERE id=?").run(
      date,
      animalId,
    );
  }
  saveSettings(db, { refugeName: "Refuge de Morée", backupIntervalHours: 0 });
  const collectionId = id();
  db.prepare(
    "INSERT INTO collections(id,name,description,created_at) VALUES (?,?,?,?)",
  ).run(
    collectionId,
    "Les petites bouilles",
    "Une sélection pour mettre nos compagnons en lumière.",
    new Date().toISOString(),
  );
  for (const p of created.slice(0, 6))
    db.prepare("INSERT INTO collection_photos VALUES (?,?)").run(
      collectionId,
      p,
    );
  // A random inaccessible password: preview access uses the loopback-only demo endpoint.
  const user = await createUser(
    db,
    "demo",
    randomBytes(32).toString("base64url"),
    "admin",
  );
  const nala = db
    .prepare("SELECT * FROM animals WHERE source_id='demo:1'")
    .get();
  const maya = db
    .prepare("SELECT * FROM animals WHERE source_id='demo:2'")
    .get();
  for (const [animal, names] of [
    [nala, ["milo", "oscar"]],
    [maya, ["plume", "simba"]],
  ])
    for (const name of names) {
      const p = await ingest(
        db,
        c,
        animal.id,
        createReadStream(path.join(root, "demo", "images", name + ".jpg")),
        name + "-illustration.jpg",
      );
      db.prepare("UPDATE photos SET caption=? WHERE id=?").run(
        "Photo d’illustration · profil fictif",
        p.id,
      );
    }
  db.prepare(
    "UPDATE animals SET breed=?,compatibility=?,source_metadata=? WHERE id=?",
  ).run(
    "Apparence Golden Retriever",
    JSON.stringify({
      chien: "À tester",
      chat: "À tester",
      enfant: "À préciser",
    }),
    JSON.stringify({
      size: "Moyenne",
      descriptionEntente:
        "Les ententes de ce profil fictif sont à vérifier, aucune disponibilité réelle n’est annoncée.",
    }),
    nala.id,
  );
  const paco = db
    .prepare("SELECT * FROM animals WHERE source_id='demo:12'")
    .get();
  db.prepare("INSERT INTO shoot_tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id(),
    paco.id,
    "Son premier portrait",
    "Fiche fictive · prévoir une série en extérieur et un portrait de profil.",
    "high",
    "todo",
    user.id,
    null,
    now(),
    now(),
  );
  db.prepare("INSERT INTO shoot_tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id(),
    nala.id,
    "Une nouvelle série de portraits",
    "Démo : mettre à jour ses expressions et choisir une couverture.",
    "normal",
    "progress",
    user.id,
    null,
    now(),
    now(),
  );
  for (const animal of db.prepare("SELECT * FROM animals").all()) {
    if (animal.archived_at)
      db.prepare("UPDATE animals SET departed_at=? WHERE id=?").run(
        animal.archived_at,
        animal.id,
      );
    feedEvent(db, animal, animal.archived_at ? "removed" : "added");
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const c = config();
  if (!c.demo)
    throw new Error(
      "Pour un aperçu isolé, utilisez npm run preview. Le peuplement manuel exige DEMO_MODE=true et un stockage de démonstration.",
    );
  const db = openDb(c);
  try {
    await seed(db, c);
    console.log(
      "Données fictives créées. Utilisez un stockage de démonstration séparé.",
    );
  } finally {
    db.close();
  }
}
