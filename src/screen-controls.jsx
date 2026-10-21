import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function ScreenControls({ screen, notify }) {
  const [cfg, setCfg] = useState(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [snapshot, setSnapshot] = useState(null),
    [stamp, setStamp] = useState(""),
    [waiting, setWaiting] = useState(false),
    [live, setLive] = useState(false);
  useEffect(() => {
    if (!open || !live || !cfg?.captureEnabled) return;
    let active = true;
    const request = () => {
      if (document.visibilityState !== "hidden")
        api("/admin/display/screens/" + screen.id + "/command", {
          method: "POST",
          body: { kind: "snapshot" },
        })
          .then(() => active && setWaiting(true))
          .catch(() => {});
    };
    request();
    const timer = setInterval(request, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, live, cfg?.captureEnabled, screen.id]);
  useEffect(() => {
    if (open)
      api("/admin/display/screens/" + screen.id + "/config")
        .then((d) => setCfg(d.config))
        .catch((e) => notify(e.message, "error"));
  }, [open, screen.id]);
  useEffect(() => {
    let active = true,
      timer,
      tries = 0,
      url;
    const load = async () => {
      try {
        const r = await fetch(
          "/api/admin/display/screens/" + screen.id + "/snapshot",
          { cache: "no-store" },
        );
        if (r.ok) {
          const captured = r.headers.get("X-Captured-At");
          if (active) {
            const next = URL.createObjectURL(await r.blob());
            setSnapshot((previous) => {
              if (previous) URL.revokeObjectURL(previous);
              return next;
            });
            setStamp(captured);
          }
        }
      } catch {}
      if (active && waiting && tries++ < 8) timer = setTimeout(load, 5000);
      else if (active) setWaiting(false);
    };
    if (open) load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, waiting, screen.id]);
  useEffect(
    () => () => {
      if (snapshot) URL.revokeObjectURL(snapshot);
    },
    [snapshot],
  );
  const command = async (kind) => {
    setBusy(true);
    try {
      await api("/admin/display/screens/" + screen.id + "/command", {
        method: "POST",
        body: { kind },
      });
      if (kind === "snapshot") setWaiting(true);
      notify(
        kind === "snapshot"
          ? "Capture demandée. Réception au prochain contact de la TV."
          : "Actualisation demandée.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="screen-extra-settings">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        {open ? "Fermer les réglages" : "Réglages & aperçu réel"}
      </Button>
      {open && (
        <>
          <div className="screen-commands">
            <Button
              variant={live ? "" : "secondary"}
              disabled={!cfg?.captureEnabled}
              onClick={() => setLive((v) => !v)}
            >
              {live ? "Arrêter le suivi visuel" : "Suivi visuel · 45 s"}
            </Button>
            <Button
              disabled={busy || waiting}
              variant="secondary"
              onClick={() => command("snapshot")}
            >
              {waiting ? "Réception de la capture…" : "Capturer l’écran"}
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => command("refresh")}
            >
              Actualiser le programme
            </Button>
          </div>
          {snapshot ? (
            <>
              <img
                className="tv-snapshot"
                src={snapshot}
                alt={"Dernière capture réelle de " + screen.name}
              />
              <p className="tv-capture-note">
                Capture reçue le {new Date(stamp).toLocaleString("fr-FR")} ·
                aperçu ponctuel, sans capture du bureau.
              </p>
            </>
          ) : (
            <p className="tv-capture-note">
              Demandez une capture pour voir ce que la TV affiche réellement. Le
              navigateur de la TV doit rester ouvert et connecté.
            </p>
          )}
          {cfg && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/admin/display/screens/" + screen.id + "/config", {
                    method: "PUT",
                    body: cfg,
                  });
                  notify(
                    "Réglages enregistrés. Appliqués au prochain contact de cet écran.",
                  );
                } catch (e) {
                  notify(e.message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {[
                [
                  "orientation",
                  "Orientation",
                  [
                    ["inherit", "Programme général"],
                    ["landscape", "Horizontal"],
                    ["portrait", "Vertical"],
                  ],
                ],
                [
                  "stats",
                  "Statistiques",
                  [
                    ["inherit", "Programme général"],
                    ["on", "Afficher"],
                    ["off", "Masquer"],
                  ],
                ],
                [
                  "showQr",
                  "QR code",
                  [
                    ["inherit", "Programme général"],
                    ["on", "Afficher"],
                    ["off", "Masquer"],
                  ],
                ],
              ].map(([key, label, choices]) => (
                <label key={key}>
                  {label}
                  <select
                    value={cfg[key]}
                    onChange={(e) => setCfg({ ...cfg, [key]: e.target.value })}
                  >
                    {choices.map(([k, n]) => (
                      <option key={k} value={k}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Durée d’une photo (0 : programme)
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={cfg.photoSeconds}
                  onChange={(e) =>
                    setCfg({ ...cfg, photoSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Actualisation (secondes)
                <input
                  type="number"
                  min="15"
                  max="300"
                  value={cfg.refreshSeconds}
                  onChange={(e) =>
                    setCfg({ ...cfg, refreshSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <div>
                {[
                  ["dog", "Chiens"],
                  ["cat", "Chats"],
                  ["other", "NAC"],
                ].map(([k, n]) => (
                  <label className="check" key={k}>
                    <input
                      type="checkbox"
                      checked={cfg.species.includes(k)}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          species: e.target.checked
                            ? [...cfg.species, k]
                            : cfg.species.filter((x) => x !== k),
                        })
                      }
                    />
                    {n}
                  </label>
                ))}
              </div>
              {[
                [
                  "autoReconnect",
                  "Reprendre automatiquement après perte de connexion",
                ],
                ["captureEnabled", "Autoriser les captures de ce lecteur"],
              ].map(([k, n]) => (
                <label key={k} className="check">
                  <input
                    type="checkbox"
                    checked={cfg[k]}
                    onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })}
                  />
                  {n}
                </label>
              ))}
              <Button disabled={busy || !cfg.species.length} type="submit">
                Enregistrer cet écran
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
