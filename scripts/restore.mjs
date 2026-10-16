import path from "node:path";
import { restoreBackup } from "../server/backup.mjs";
const [archive, destination] = process.argv.slice(2);
if (!archive || !destination)
  throw new Error(
    "Usage : npm run restore -- sauvegarde.tar.gz /nouvelle/destination",
  );
console.log(
  await restoreBackup(path.resolve(archive), path.resolve(destination)),
);
