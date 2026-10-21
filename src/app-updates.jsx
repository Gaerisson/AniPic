import { useEffect, useState } from "react";
import { appVersion } from "../shared/version.mjs";
import { Button } from "./ui.jsx";
export function AppUpdates() {
  const [update, setUpdate] = useState(null),
    [dismissed, setDismissed] = useState("");
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const [web, apk] = await Promise.all([
          fetch("/app-version.json", { cache: "no-store" }).then((r) =>
            r.json(),
          ),
          fetch("/android-download.json", { cache: "no-store" }).then((r) =>
            r.json(),
          ),
        ]);
        let native = Number(
          new URLSearchParams(location.search).get("native") ||
            sessionStorage.getItem("anipic-native-version") ||
            0,
        );
        if (native)
          sessionStorage.setItem("anipic-native-version", String(native));
        if (active)
          setUpdate(
            native && apk.versionCode > native
              ? { kind: "apk", version: apk.version }
              : web.version !== appVersion
                ? { kind: "web", version: web.version }
                : null,
          );
      } catch {}
    };
    check();
    const timer = setInterval(check, 15 * 60000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);
  if (!update || dismissed === update.kind + update.version) return null;
  return (
    <div className="update-notice" role="status">
      <div>
        <strong>AniPic {update.version} est disponible</strong>
        <p>
          {update.kind === "apk"
            ? "Télécharger la mise à jour et ouvrir l’installation Android. Vos données restent conservées."
            : "Enregistrez votre travail en cours puis actualisez pour profiter des nouveautés."}
        </p>
      </div>
      {update.kind === "apk" ? (
        <a
          className="button"
          href="intent://update#Intent;scheme=anipic;package=fr.gaerisson.anipic;S.browser_fallback_url=https%3A%2F%2Fanipic.gaerisson.fr%2Fandroid;end"
        >
          Mettre à jour
        </a>
      ) : (
        <Button onClick={() => location.reload()}>Actualiser</Button>
      )}
      <Button
        variant="ghost"
        onClick={() => setDismissed(update.kind + update.version)}
      >
        Plus tard
      </Button>
    </div>
  );
}
