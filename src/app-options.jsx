import { useEffect, useState } from "react";
import {
  Settings,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Bell,
  Smartphone,
  Download,
} from "lucide-react";
import { Button } from "./ui.jsx";
import {
  appDestinations,
  appWidgets,
  readAppPreferences,
  saveAppPreferences,
  appPreferenceDefaults,
} from "./app-preferences.mjs";
import { browserTheme, rememberTheme } from "./theme-store.mjs";
export function useAppPreferences() {
  const [prefs, setPrefs] = useState(() => readAppPreferences());
  useEffect(() => {
    const update = () => setPrefs(readAppPreferences());
    window.addEventListener("anipic-app-preferences", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("anipic-app-preferences", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.appText = prefs.largeText
      ? "large"
      : "normal";
    document.documentElement.dataset.appMotion = prefs.reduceMotion
      ? "reduced"
      : "normal";
  }, [prefs.largeText, prefs.reduceMotion]);
  return prefs;
}
export default function AppOptions({ go, user, open, notify, ui = {} }) {
  const prefs = useAppPreferences();
  const [theme, setTheme] = useState(() => browserTheme() || "spa");
  const update = (patch) => {
    try {
      saveAppPreferences({ ...prefs, ...patch });
    } catch {
      notify("La mémorisation est indisponible sur ce navigateur.", "error");
    }
  };
  const move = (key, i, delta) => {
    const list = [...prefs[key]],
      next = i + delta;
    if (next < 0 || next >= list.length || (key === "nav" && next === 0))
      return;
    [list[i], list[next]] = [list[next], list[i]];
    update({ [key]: list });
  };
  return (
    <div className="app-options">
      <header className="page-heading">
        <div>
          <span className="eyebrow">VOTRE ANIPIC</span>
          <h1>Options de l’application</h1>
          <p>
            Votre navigation, votre accueil et vos préférences, mémorisés sur
            cet appareil.
          </p>
        </div>
        <Settings size={28} />
      </header>
      <section className="panel options-panel">
        <header>
          <Smartphone size={24} />
          <div>
            <h2>Vos boutons du bas</h2>
            <p>
              Refuge reste toujours accessible. Choisissez jusqu’à quatre autres
              accès ; « Plus » conserve tous les outils.
            </p>
          </div>
        </header>
        <div className="app-nav-editor">
          {prefs.nav.map((p, i) => (
            <div key={p}>
              <b>{i + 1}</b>
              <span>{appDestinations.find((d) => d.page === p)?.name}</span>
              {i > 0 && (
                <>
                  <Button
                    variant="quiet"
                    aria-label={"Monter " + p}
                    disabled={i === 1}
                    onClick={() => move("nav", i, -1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={"Descendre " + p}
                    disabled={i === prefs.nav.length - 1}
                    onClick={() => move("nav", i, 1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <button
                    className="text-link"
                    onClick={() =>
                      update({ nav: prefs.nav.filter((x) => x !== p) })
                    }
                  >
                    Retirer
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <label>
          Ajouter un raccourci
          <select
            value=""
            disabled={prefs.nav.length >= 5}
            onChange={(e) => update({ nav: [...prefs.nav, e.target.value] })}
          >
            <option value="">Choisir une page…</option>
            {appDestinations
              .filter(
                (d) =>
                  !prefs.nav.includes(d.page) &&
                  (!d.module || ui.enabledModules?.[d.module] !== false),
              )
              .map((d) => (
                <option key={d.page} value={d.page}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
      </section>
      <section className="panel options-panel">
        <h2>Votre accueil Android</h2>
        <p>Activez vos widgets et placez les informations utiles en premier.</p>
        <div className="app-widget-editor">
          {[
            ...prefs.widgets,
            ...Object.keys(appWidgets).filter(
              (k) => !prefs.widgets.includes(k),
            ),
          ].map((key, i) => (
            <div key={key}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={prefs.widgets.includes(key)}
                  onChange={(e) =>
                    update({
                      widgets: e.target.checked
                        ? [...prefs.widgets, key]
                        : prefs.widgets.filter((x) => x !== key),
                    })
                  }
                />
                {appWidgets[key]}
              </label>
              {prefs.widgets.includes(key) && (
                <>
                  <Button
                    variant="quiet"
                    aria-label={"Monter " + appWidgets[key]}
                    disabled={i === 0}
                    onClick={() => move("widgets", i, -1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={"Descendre " + appWidgets[key]}
                    disabled={i === prefs.widgets.length - 1}
                    onClick={() => move("widgets", i, 1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel options-panel">
        <h2>Confort de lecture</h2>
        <label>
          Thème
          <select
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              rememberTheme(e.target.value);
              window.dispatchEvent(new Event("anipic-theme-changed"));
            }}
          >
            <option value="spa">SPA · clair & verre</option>
            <option value="night">Studio nuit</option>
            <option value="sage">Lumière</option>
            <option value="amber">Ambre SPA</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.largeText}
            onChange={(e) => update({ largeText: e.target.checked })}
          />
          Texte plus grand dans l’application
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.reduceMotion}
            onChange={(e) => update({ reduceMotion: e.target.checked })}
          />
          Réduire les animations de l’interface
        </label>
      </section>
      <section className="panel options-panel">
        <header>
          <Bell size={24} />
          <div>
            <h2>Notifications et appareils</h2>
            <p>
              Choisissez les événements et vérifiez que cet appareil peut les
              recevoir.
            </p>
          </div>
        </header>
        <Button
          onClick={() =>
            user
              ? go("accountHub")
              : open({ type: "login", then: "accountHub" })
          }
        >
          Configurer les notifications
        </Button>
        <a className="button secondary" href="/android">
          <Download size={17} />
          Téléchargement et mises à jour Android
        </a>
      </section>
      <Button
        variant="secondary"
        icon={RotateCcw}
        onClick={() => {
          update(appPreferenceDefaults);
          notify("Disposition initiale rétablie.");
        }}
      >
        Réinitialiser ma disposition
      </Button>
    </div>
  );
}
