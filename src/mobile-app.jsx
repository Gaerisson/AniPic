import { useEffect, useState } from "react";
import {
  Heart,
  PawPrint,
  Images,
  Tv,
  House,
  Menu,
  ArrowUpRight,
  Download,
  WifiOff,
  Smartphone,
  Rss,
  CalendarDays,
  Bell,
} from "lucide-react";
import { mobileAppLayout, mobileDestinations } from "../shared/mobile-app.mjs";
import { Button } from "./ui.jsx";
import { NavLink } from "./nav-link.jsx";
import { api } from "./api.js";
import { useAppPreferences } from "./app-options.jsx";
import { appDestinations } from "./app-preferences.mjs";
import { MobileNews, MobilePortraits } from "./mobile-widgets.jsx";
import {
  Folder,
  Printer,
  Wand2,
  BarChart3,
  Vote,
  Settings,
} from "lucide-react";
export function useMobileApp() {
  const [appMode, setAppMode] = useState(() => {
      let remembered = false;
      try {
        remembered = sessionStorage.getItem("anipic-app-layout") === "android";
      } catch {}
      return mobileAppLayout({
        search: location.search,
        standalone: matchMedia("(display-mode: standalone)").matches,
        remembered,
      });
    }),
    [installEvent, setInstallEvent] = useState(null),
    [installed, setInstalled] = useState(
      () => matchMedia("(display-mode: standalone)").matches,
    ),
    [offline, setOffline] = useState(!navigator.onLine),
    [installError, setInstallError] = useState("");
  useEffect(() => {
    document.documentElement.dataset.appLayout = appMode ? "android" : "web";
    try {
      if (appMode) sessionStorage.setItem("anipic-app-layout", "android");
      else sessionStorage.removeItem("anipic-app-layout");
    } catch {}
  }, [appMode]);
  useEffect(() => {
    const prompt = (e) => {
        e.preventDefault();
        setInstallEvent(e);
      },
      done = () => {
        setInstalled(true);
        setAppMode(true);
        setInstallEvent(null);
      },
      network = () => setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", done);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    if (
      import.meta.env.PROD &&
      window.isSecureContext &&
      "serviceWorker" in navigator
    )
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() =>
          setInstallError(
            "Installation web indisponible. Vous pouvez utiliser l’APK Android.",
          ),
        );
    return () => {
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", done);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch {
      setInstallError("Installation annulée ou indisponible.");
    }
  };
  return {
    appMode,
    installed,
    offline,
    install,
    canInstall: !!installEvent,
    installError,
  };
}
const icons = {
  home: House,
  heart: Heart,
  photos: Images,
  tv: Tv,
  feed: Rss,
  planning: CalendarDays,
  albums: Folder,
  posters: Printer,
  writing: Wand2,
  stats: BarChart3,
  polls: Vote,
};
export function AppBottomNav({ page, go, more, expanded, modules = {} }) {
  const prefs = useAppPreferences();
  const destinations = prefs.nav
    .map((p) => appDestinations.find((d) => d.page === p))
    .filter((d) => d && (!d.module || modules[d.module] !== false));
  return (
    <nav
      className="app-bottom-nav"
      aria-label="Navigation de l’application"
      style={{
        gridTemplateColumns: `repeat(${destinations.length + 1},minmax(0,1fr))`,
      }}
    >
      {destinations.map((d) => {
        const Icon = icons[d.symbol];
        return (
          <NavLink
            href={"#" + d.page}
            key={d.page}
            aria-current={page === d.page ? "page" : undefined}
            onClick={() => go(d.page)}
          >
            <Icon size={21} />
            <span>{d.name}</span>
          </NavLink>
        );
      })}
      <button
        aria-label="Tous les outils"
        aria-expanded={expanded}
        onClick={more}
      >
        <Menu size={21} />
        <span>Plus</span>
      </button>
    </nav>
  );
}
export function MobileHome({
  user,
  overview,
  go,
  open,
  runtime,
  pendingAdoptions,
  ui = {},
}) {
  const prefs = useAppPreferences();
  const widget = (key, children) =>
    prefs.widgets.includes(key) ? (
      <div
        className="mobile-widget"
        style={{ order: prefs.widgets.indexOf(key) }}
      >
        {children}
      </div>
    ) : null;
  const [summary, setSummary] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.visibilityState !== "hidden")
        api("/mobile/summary")
          .then((d) => {
            if (active) {
              setSummary(d);
              setError("");
            }
          })
          .catch((e) => active && setError(e.message));
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [user?.id]);
  const pending = pendingAdoptions || 0,
    today = summary?.today?.days?.[0];
  return (
    <div className="mobile-home mobile-home-recap">
      <div className="mobile-home-title">
        <div>
          <span className="eyebrow">
            {overview?.refugeName || "Votre refuge"}
          </span>
          <h1>{user ? "Bonjour " + user.name : "Les nouvelles du refuge"}</h1>
          <p>
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Button
          variant="ghost"
          aria-label="Options de l’application"
          onClick={() => go("appOptions")}
        >
          <Settings size={20} />
        </Button>
        <Button
          variant="secondary"
          aria-label="Compte et notifications"
          onClick={() => (user ? go("accountHub") : open({ type: "login" }))}
        >
          <Bell size={20} />
        </Button>
      </div>
      {widget(
        "recap",
        summary?.counts && (
          <section className="mobile-recap-stats">
            {[
              ["adoptions", "Adoptions", Heart],
              ["arrivals", "Arrivées", PawIcon],
              ["changes", "Changements", Images],
            ].map(([k, label, Icon]) => (
              <button
                className="panel"
                key={k}
                onClick={() =>
                  go(k === "adoptions" ? "mobileAdoptions" : "feed")
                }
              >
                <Icon size={20} />
                <strong>{summary.counts[k] || 0}</strong>
                <span>{label}</span>
                <small>7 derniers jours</small>
              </button>
            ))}
          </section>
        ),
      )}
      {widget(
        "pending",
        pending > 0 && ["admin", "agent"].includes(user?.role) && (
          <button
            className="panel mobile-pending"
            onClick={() => go("adoptionReviews")}
          >
            <Heart size={24} />
            <span>
              <strong>{pending} adoption(s) à confirmer</strong>
              <small>Vérifier les départs détectés</small>
            </span>
            <ArrowUpRight size={20} />
          </button>
        ),
      )}
      {widget(
        "feed",
        <>
          <NavLink
            href="#feed"
            onClick={() => go("feed")}
            className="panel mobile-feed-link"
          >
            <Rss size={25} />
            <span>
              <strong>Au fil du refuge</strong>
              <small>Arrivées, adoptions et changements des fiches</small>
            </span>
            <ArrowUpRight size={20} />
          </NavLink>
          <MobileNews go={go} open={open} />
        </>,
      )}
      {widget(
        "today",
        user && ui.enabledModules?.planning !== false && (
          <section className="panel mobile-today">
            <div className="widget-heading">
              <h2>Au refuge aujourd’hui</h2>
              <Button variant="ghost" onClick={() => go("volunteers")}>
                Planning ↗
              </Button>
            </div>
            {today?.people.length ? (
              <div className="today-people">
                {today.people.map((p) => (
                  <span key={p.id}>
                    <b>{p.name}</b>
                    <small>{p.tasks.join(" · ")}</small>
                  </span>
                ))}
              </div>
            ) : (
              <p>Aucune présence confirmée. Ajoutez votre disponibilité.</p>
            )}
            {summary?.next?.length > 0 && (
              <>
                <h3>Mes prochains créneaux</h3>
                {summary.next.map((s) => (
                  <button
                    className="mobile-next-shift"
                    key={s.id}
                    onClick={() => go("volunteers")}
                  >
                    <CalendarDays size={18} />
                    <span>
                      {s.title}
                      <small>
                        {s.date} · {s.start}–{s.end}
                      </small>
                    </span>
                  </button>
                ))}
              </>
            )}
          </section>
        ),
      )}
      {widget(
        "shortcuts",
        <div className="mobile-destination-grid">
          {[
            { page: "mobilePhotos", name: "Les portraits", Icon: Images },
            {
              page: "volunteers",
              name: "Présences & missions",
              Icon: CalendarDays,
              module: "planning",
            },
            {
              page: "broadcasts",
              name: "Vidéo C8",
              Icon: Tv,
              module: "broadcasts",
            },
            {
              page: "posters",
              name: "Créer une affiche",
              Icon: Download,
              module: "posters",
            },
          ]
            .filter((d) => !d.module || ui.enabledModules?.[d.module] !== false)
            .map(({ page, name, Icon }) => (
              <NavLink
                key={page}
                href={"#" + page}
                onClick={() => go(page)}
                className="panel mobile-destination"
              >
                <Icon size={25} />
                <strong>{name}</strong>
                <ArrowUpRight size={19} />
              </NavLink>
            ))}
        </div>,
      )}
      {error && <p role="status">{error}</p>}
      {!user && (
        <Button onClick={() => open({ type: "login" })}>
          Rejoindre mon espace équipe
        </Button>
      )}
      {widget("portraits", <MobilePortraits go={go} open={open} />)}
      {widget(
        "notifications",
        <button
          className="panel mobile-pending"
          onClick={() => (user ? go("accountHub") : open({ type: "login" }))}
        >
          <Bell size={22} />
          <span>
            <strong>Mes notifications</strong>
            <small>Adoptions, arrivées et nouveaux portraits</small>
          </span>
          <ArrowUpRight size={19} />
        </button>,
      )}
      <button
        className="text-link mobile-configure"
        onClick={() => go("appOptions")}
      >
        <Settings size={16} />
        Personnaliser mon accueil
      </button>
      <a href="/android" className="mobile-apk-link">
        <Download size={16} />
        Télécharger ou mettre à jour l’app Android
      </a>
    </div>
  );
}
const PawIcon = PawPrint;
export function AppConnection({ offline }) {
  return offline ? (
    <div role="status" className="app-offline-banner">
      <WifiOff size={16} />
      Hors connexion · les actions reprendront avec le serveur.
    </div>
  ) : null;
}
