import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "../server/config.mjs";
import { openDb } from "../server/db.mjs";
import { createUser } from "../server/auth.mjs";
const db = openDb(config());
if (db.prepare("SELECT id FROM users LIMIT 1").get()) {
  console.error(
    "Un compte existe déjà. Gérez les comptes depuis l’administration.",
  );
  db.close();
  process.exit(1);
}
const rl = readline.createInterface({ input: stdin, output: stdout });
const name = (
  await rl.question("Identifiant administrateur (3–40 caractères) : ")
).trim();
if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(name)) {
  rl.close();
  db.close();
  throw new Error("Identifiant invalide.");
}
rl.close();
async function secret(prompt) {
  stdout.write(prompt);
  if (!stdin.isTTY)
    throw new Error(
      "Utilisez un terminal interactif (docker compose exec -it anipic npm run setup).",
    );
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  return new Promise((resolve, reject) => {
    function onData(chunk) {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Annulé."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") value += character;
      }
    }
    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }
    stdin.on("data", onData);
  });
}
try {
  const password = await secret(
    "Mot de passe (12 caractères minimum, saisie masquée) : ",
  );
  const confirm = await secret("Confirmer : ");
  if (password.length < 12 || password.length > 200 || password !== confirm)
    throw new Error("Mot de passe invalide ou confirmation différente.");
  await createUser(db, name, password);
  console.log("Administrateur créé. Connectez-vous depuis Anipic.");
} finally {
  db.close();
}
