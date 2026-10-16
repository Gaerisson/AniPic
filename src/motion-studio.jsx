import { useEffect, useState } from "react";
import { Film, Monitor, Smartphone } from "lucide-react";
import { api } from "./api.js";
import { Button, Empty } from "./ui.jsx";
import { showDefaults } from "../shared/signage.mjs";
import { ShowPlayer } from "./show-player.jsx";
import { ShowOptions, MotionExports } from "./show-options.jsx";
export default function MotionStudio({ user, notify }) {
  const [program, setProgram] = useState({
      ...showDefaults,
      mode: "wallpaper",
      maxAnimals: 8,
      introSeconds: 4,
      motion: "3d",
      pace: "dynamic",
      style: "cards",
      statsEvery: 0,
    }),
    [hidden, setHidden] = useState([]),
    [show, setShow] = useState(null),
    [tab, setTab] = useState("programme"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const timer = setTimeout(
      () =>
        api("/motion/preview", {
          method: "POST",
          body: { program, hiddenIds: hidden },
        })
          .then((v) => {
            if (alive) {
              setShow(v);
              setError("");
            }
          })
          .catch((e) => {
            if (alive) {
              setShow(null);
              setError(e.message);
            }
          }),
      450,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [program, hidden, user?.id]);
  if (!user)
    return (
      <Empty
        icon={Film}
        title="Fonds animés & réseaux"
        text="Connectez-vous pour créer un film."
      />
    );
  const preset = (mode, orientation) =>
    setProgram((v) => ({
      ...v,
      mode,
      orientation,
      maxAnimals: mode === "wallpaper" ? 12 : 4,
      photoSeconds: 4,
      photosPerAnimal: 1,
      introSeconds: mode === "wallpaper" ? 0 : 3,
      pace: "dynamic",
      intensity: 60,
      statsEvery: mode === "wallpaper" ? 0 : 4,
      logoEvery: 0,
      style: mode === "wallpaper" ? "cards" : "glass",
    }));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Fonds animés & réseaux</h1>
          <p className="muted">
            Photos, portraits, logo SPA et séquences animées.
          </p>
        </div>
        <Button
          icon={Film}
          disabled={busy || !show || user.role === "viewer"}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/motion/render", {
                method: "POST",
                body: {
                  program,
                  hiddenIds: hidden,
                  title:
                    program.title ||
                    (program.mode === "wallpaper"
                      ? "Fond animé SPA"
                      : "Présentation du refuge"),
                },
              });
              notify("Création du MP4 lancée.");
            } catch (e) {
              notify(e.message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Exporter en MP4
        </Button>
      </div>
      <div className="motion-presets">
        {[
          ["wallpaper", "landscape", "Fond PC animé", Monitor],
          ["wallpaper", "portrait", "Mosaïque story", Smartphone],
          ["reception", "portrait", "Portraits en story", Smartphone],
          ["reception", "landscape", "Présentation TV", Monitor],
        ].map(([m, o, l, Icon]) => (
          <button key={l} onClick={() => preset(m, o)}>
            <Icon size={21} />
            <span>{l}</span>
          </button>
        ))}
      </div>
      <div className="signage-editor">
        <div className="panel signage-config">
          <div className="signage-tabs">
            {["programme", "style"].map((t) => (
              <button
                className={t === tab ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t === "style" ? "Style & format" : "Programme"}
              </button>
            ))}
          </div>
          <ShowOptions
            program={program}
            change={setProgram}
            section={tab}
            hidden={hidden}
            setHidden={setHidden}
          />
        </div>
        <div className="signage-preview-col">
          {show ? (
            <>
              <div className="section-heading">
                <h3>Aperçu animé</h3>
                <span>
                  {Math.round(show.duration)} s · {show.items.length} animaux
                </span>
              </div>
              <ShowPlayer show={show} />
            </>
          ) : (
            <Empty
              icon={Film}
              title="Préparer la sélection"
              text={error || "Chargement des médias…"}
            />
          )}
          <p className="muted">
            MP4 1080p · lecture muette · médias publics, références SPA
            signalées. Le format portrait convient aux stories et reels ; le
            format horizontal aux écrans PC et TV.
          </p>
          <MotionExports canEdit={user.role !== "viewer"} notify={notify} />
        </div>
      </div>
    </>
  );
}
