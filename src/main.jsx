import { browserTheme, rememberTheme } from "./theme-store.mjs";
import {
  useMobileApp,
  MobileHome,
  AppBottomNav,
  AppConnection,
} from "./mobile-app.jsx";
const InternalRegister = lazy(() => import("./internal-register.jsx"));
const GroupPoster = lazy(() => import("./group-poster.jsx"));
const AdoptionReviews = lazy(() => import("./adoption-reviews.jsx"));
const Agenda = lazy(() => import("./agenda.jsx"));
const BatchPosters = lazy(() => import("./batch-posters.jsx"));
import { SiteGate } from "./site-access.jsx";
import { useUndo } from "./undo.jsx";
import { accessForPage, canManageDisplay } from "../shared/page-access.mjs";
const DisplaySettings = lazy(() =>
  import("./refuge-display.jsx").then((m) => ({ default: m.DisplaySettings })),
);
import {
  useState,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  Component,
} from "react";
import {
  PawPrint,
  Clock,
  Images,
  Heart,
  Archive,
  Camera,
  LayoutDashboard,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  MoreHorizontal,
  Folder,
  LockKeyhole,
  Menu,
  AlertCircle,
  Sun,
  Eye,
  Video,
  Rss,
  Bell,
  Wand2,
  Flag,
  Palette,
  SlidersHorizontal,
  Info,
  Undo2,
  CalendarDays,
  Smartphone,
} from "lucide-react";
import { api, setCsrf, uid } from "./api.js";
import { createRoot } from "react-dom/client";
import { Spinner, Empty, Button } from "./ui.jsx";
import { Library } from "./library.jsx";
import { Inbox } from "./inbox.jsx";
import { PhotoAssignmentDialog } from "./photo-assignment.jsx";
import { ShootSheet } from "./shoot-sheet.jsx";
import { StatusAppearanceContext } from "./animal-status.jsx";
import { DownloadDialog } from "./downloads.jsx";
import { CanvaDialog } from "./canva.jsx";
import { QuickAssistant, About } from "./assistant.jsx";
import { UserPicture } from "./user-avatar.jsx";
import { Login, AnimalDetail, UploadForm, Account } from "./dialogs.jsx";
import {
  Collections,
  CollectionForm,
  CollectionView,
  AlbumPhoto,
} from "./collections.jsx";
import { Broadcasts } from "./broadcasts.jsx";
import { HomeMessages, useTeamMessages } from "./messages.jsx";
import { CommunicationDialog } from "./communication.jsx";
import { RefugeActivity } from "./refuge-activity.jsx";
const Visitors = lazy(() =>
  import("./visitors.jsx").then((m) => ({ default: m.Visitors })),
);
const RefugeScreen = lazy(() =>
  import("./refuge-display.jsx").then((m) => ({ default: m.RefugeScreen })),
);
const Admin = lazy(() =>
  import("./admin.jsx").then((m) => ({ default: m.Admin })),
);
import { Insights } from "./insights.jsx";
import {
  ShootBoard,
  TaskForm,
  AgentTools,
  Feed,
  SocialDraft,
} from "./tools.jsx";
const Studio = lazy(() => import("./studio.jsx"));
const MotionStudio = lazy(() => import("./motion-studio.jsx"));
const Wallpaper = lazy(() => import("./wallpaper.jsx"));
const PhotoEditor = lazy(() => import("./photo-editor.jsx"));
class StudioBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Empty
        icon={Video}
        title="Le studio n’a pas pu se charger."
        text="Actualisez la page pour récupérer la version disponible."
        action={<Button onClick={() => location.reload()}>Actualiser</Button>}
      />
    ) : (
      this.props.children
    );
  }
}
import "./styles.css";
import "./experience.css";
import "./studio-theme.css";
import "./refinements.css";
import "./workflow.css";
import "./canva.css";
import "./workbench.css";
import "./polish.css";
import "./refuge-polish.css";
import "./cohesion.css";
import "./team-workflow.css";
import "./signage.css";
import "./update31.css";

import {
  usePrivacy,
  CookieChoices,
  LegalPage,
  LegalSettings,
} from "./privacy.jsx";
import { AppUpdates } from "./app-updates.jsx";
import { pageModule } from "../shared/modules.mjs";
import "./update312.css";
import "./features312.css";
import { PublicPosters } from "./public-posters.jsx";
import { QuickTour } from "./quick-tour.jsx";
const TeamPlanning = lazy(() => import("./team-planning.jsx"));
const WritingStudio = lazy(() => import("./writing-studio.jsx"));
const AccountHub = lazy(() => import("./account-hub.jsx"));
const ModuleSettings = lazy(() => import("./module-settings.jsx"));
const iconProps = { size: 19, strokeWidth: 1.7 };
const pages = {
  mobile: { name: "Mon refuge", icon: Smartphone, group: "library" },
  mobileAdoptions: { name: "Les adoptions", icon: Heart, group: "library" },
  mobilePhotos: { name: "Photos", icon: Images, group: "library" },
  adoptionReviews: {
    name: "Adoptions à confirmer",
    icon: Heart,
    group: "team",
    roles: ["admin", "agent"],
  },
  volunteers: {
    name: "Présences & missions",
    icon: CalendarDays,
    group: "team",
    roles: ["admin", "agent", "editor", "volunteer", "viewer"],
  },
  writing: {
    name: "Rédaction & relecture",
    icon: Wand2,
    group: "team",
    roles: ["admin", "agent", "editor", "volunteer", "viewer"],
  },
  accountHub: {
    name: "Compte & appareils",
    icon: Smartphone,
    group: "team",
    roles: ["admin", "agent", "editor", "volunteer", "viewer"],
  },
  modules: { name: "Modules", icon: Settings, group: "admin" },
  privacy: { name: "Confidentialité", icon: ShieldCheck, group: "info" },
  terms: { name: "Conditions d’utilisation", icon: Info, group: "info" },
  legal: { name: "Mentions légales", icon: Info, group: "info" },
  legalSettings: {
    name: "Mentions et confidentialité",
    icon: ShieldCheck,
    group: "admin",
  },
  visitors: { name: "Visiteurs", icon: Eye, group: "admin" },
  history: { name: "Historique SPA", icon: RefreshCw, group: "library" },
  display: { name: "Écran du refuge", icon: Eye, group: "library" },
  displaySettings: {
    name: "Écran du refuge",
    icon: Eye,
    group: "team",
    roles: ["admin", "agent"],
  },
  register: { name: "Registre interne", icon: ShieldCheck, group: "team" },
  groupPoster: {
    name: "Grande affiche du refuge",
    icon: Images,
    group: "library",
  },
  posters: { name: "Affiches de box en série", icon: Images, group: "library" },
  gallery: { name: "Accueil & photos", icon: Images, group: "library" },
  animals: { name: "Les animaux", icon: PawPrint, group: "library" },
  collections: { name: "Albums privés", icon: Folder, group: "library" },
  favorites: { name: "Mes favoris", icon: Heart, group: "library" },
  todo: { name: "Planning photo", icon: Flag, group: "library" },
  inbox: { name: "Photos à trier", icon: Folder, group: "library" },
  print: { name: "Feuille de séance", icon: Camera, group: "print" },
  archives: { name: "Archives", icon: Archive, group: "library" },
  studio: { name: "Studio vidéo", icon: Video, group: "library" },
  editor: { name: "Éditeur photo", icon: SlidersHorizontal, group: "library" },
  motion: { name: "Fonds animés & réseaux", icon: Video, group: "library" },
  wallpaper: { name: "Visuels & bannières", icon: Images, group: "library" },
  messages: { name: "Messages équipe", icon: Bell, group: "admin" },
  migration: { name: "Import GPIC", icon: Archive, group: "admin" },
  about: { name: "À propos", icon: Info, group: "info" },
  broadcasts: { name: "Vidéo C8", icon: Video, group: "library" },
  tools: { name: "Outils de l’équipe", icon: Wand2, group: "library" },
  agenda: {
    name: "Agenda partagé",
    icon: CalendarDays,
    group: "library",
    roles: ["admin", "editor", "agent", "volunteer", "viewer"],
  },
  stats: { name: "Statistiques", icon: LayoutDashboard, group: "library" },
  api: { name: "API & connexions", icon: RefreshCw, group: "admin" },
  feed: { name: "Le fil du refuge", icon: Rss, group: "library" },
  dashboard: { name: "Vue d’ensemble", icon: LayoutDashboard, group: "admin" },
  journal: { name: "Journal", icon: Clock, group: "admin" },
  sync: { name: "Synchronisation", icon: RefreshCw, group: "admin" },
  storage: { name: "Stockage", icon: HardDrive, group: "admin" },
  backups: { name: "Sauvegardes", icon: ShieldCheck, group: "admin" },
  settings: { name: "Configuration", icon: Settings, group: "admin" },
  users: { name: "Équipe & accès", icon: Users, group: "admin" },
};
function App() {
  const privacy = usePrivacy();
  const [cookiePanel, setCookiePanel] = useState(false);
  const [modules, setModules] = useState({});
  const [publicPosters, setPublicPosters] = useState(true);
  const [page, setPage] = useState(() => {
    const value =
      location.hash.slice(1) === "departures"
        ? "archives"
        : location.hash.slice(1);
    return pages[value] ? value : "gallery";
  });
  const [user, setUser] = useState(null),
    [overview, setOverview] = useState(null),
    [session, setSession] = useState(null),
    [gateRequired, setGateRequired] = useState(false),
    [version, setVersion] = useState(0),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [q, setQ] = useState(""),
    [mobile, setMobile] = useState(false),
    [connectionError, setConnectionError] = useState("");
  const [theme, setTheme] = useState(() => browserTheme());
  const appRuntime = useMobileApp();
  useEffect(() => {
    const load = () =>
      api("/modules")
        .then((d) => {
          setModules(d.modules);
          setPublicPosters(d.publicPosters);
        })
        .catch(() => {});
    load();
    window.addEventListener("anipic-modules", load);
    return () => window.removeEventListener("anipic-modules", load);
  }, [version, user?.id]);

  const [animations, setAnimations] = useState(
    () =>
      localStorage.getItem("anipic-animations") !== "false" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const sync = (e) => {
      if (e.key === "anipic-theme")
        setTheme(
          browserTheme() || overview?.interface?.themeDefault || "night",
        );
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [overview?.interface?.themeDefault]);
  const [videoDraft, setVideoDraft] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme || "night";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        ["spa", "sage"].includes(theme) ? "#fff8f0" : "#121315",
      );
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.motion = animations ? "on" : "off";
    localStorage.setItem("anipic-animations", String(animations));
  }, [animations]);
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width: 800px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 800px)");
    const update = () => {
      setNarrow(media.matches);
      setMobile(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const closeOnEscape = (e) => {
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobile]);
  useEffect(() => {
    const listener = () => {
      if (location.hash === "#departures")
        history.replaceState(null, "", "#archives");
      const key = location.hash.slice(1);
      if (/^canva\/[a-f0-9-]{36}$/i.test(key)) {
        setModal({ type: "canva", animalId: key.slice(6) });
        return;
      }
      if (/^animal\/[a-f0-9-]{36}$/i.test(key)) {
        setModal({ type: "animal", id: key.slice(7) });
        return;
      }
      if (pages[key]) {
        setPage(key);
        setQ("");
      }
    };
    window.addEventListener("hashchange", listener);
    if (
      /^#(animal|canva)\//.test(location.hash) ||
      location.hash === "#departures"
    )
      listener();
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("anipic-favorites") || "[]",
      );
      return Array.isArray(stored)
        ? stored
            .filter(
              (value) =>
                typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value),
            )
            .slice(0, 200)
        : [];
    } catch {
      return [];
    }
  });
  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const [pendingAdoptions, setPendingAdoptions] = useState(0);
  useEffect(() => {
    if (!["admin", "agent"].includes(user?.role)) {
      setPendingAdoptions(0);
      return;
    }
    let active = true;
    const load = () => {
      if (document.visibilityState !== "hidden")
        api("/adoption-reviews?countOnly=1")
          .then((d) => active && setPendingAdoptions(d.total))
          .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [user?.id, version]);
  const undo = useUndo(user, notify, reload);
  const [navOpen, setNavOpen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("anipic-nav") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    const result = new URLSearchParams(location.search).get("canva");
    if (!result) return;
    notify(
      result === "connected"
        ? "Compte Canva connecté. Votre pré-design vous attend."
        : result === "denied"
          ? "Connexion Canva annulée."
          : "Connexion Canva impossible. Vérifiez les réglages et relancez la connexion.",
      result === "connected" ? "success" : "error",
    );
    const url = new URL(location.href);
    url.searchParams.delete("canva");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [notify]);
  useEffect(() => {
    let active = true;
    (async () => {
      const s = await api("/session");
      if (!active) return;
      setSession(s);
      setUser(s.user);
      setCsrf(s.user?.csrf);
      setGateRequired(!!s.gateRequired);
      if (s.gateRequired) {
        setConnectionError("");
        return;
      }
      const o = await api("/overview");
      if (active) {
        setOverview(o);
        setConnectionError("");
      }
    })().catch((e) => active && setConnectionError(e.message));
    return () => {
      active = false;
    };
  }, [version]);
  useEffect(() => {
    const result = new URLSearchParams(location.search).get("google");
    if (!result) return;
    if (result === "connected") {
      const u = new URL(location.href);
      u.searchParams.delete("google");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
      notify("Connexion Google réussie.");
    } else setModal({ type: "login" });
  }, []);
  const close = useCallback(() => setModal(null), []);
  const canEdit = user && ["admin", "editor", "agent"].includes(user.role);
  const canCreate =
    !!user && ["admin", "editor", "agent", "volunteer"].includes(user.role);
  const go = (key) => {
    if (key === "departures") key = "archives";
    if (key === "displaySettings" && !canManageDisplay(user)) {
      if (!user) setModal({ type: "login", then: key });
      else
        notify(
          "La configuration de l’écran est réservée aux agents SPA et à l’administration.",
          "error",
        );
      return;
    }
    if (pages[key].group === "admin" && user?.role !== "admin") {
      setModal({ type: "login", then: key });
      return;
    }
    setPage(key);
    location.hash = key;
    setQ("");
    setMobile(false);
    window.scrollTo(0, 0);
  };
  const login = (u, next) => {
    setUser(u);
    setCsrf(u.csrf);
    close();
    reload();
    if (next) {
      setPage(next);
      location.hash = next;
    }
  };
  const requireEdit = (action) => {
    if (canEdit) action();
    else setModal({ type: "login" });
  };
  const upload = () => requireEdit(() => go("inbox"));
  const favorite = async (animal) => {
    if (user) {
      try {
        await api(`/animals/${animal.id}/favorite`, {
          method: "POST",
          body: { favorite: !animal.favorite },
        });
        reload();
      } catch (e) {
        notify(e.message, "error");
      }
    } else {
      if (!favorites.includes(animal.id) && favorites.length >= 200) {
        notify(
          "La limite de 200 favoris sur cet appareil est atteinte. Connectez-vous pour enregistrer davantage de favoris.",
          "error",
        );
        return;
      }
      const next = favorites.includes(animal.id)
        ? favorites.filter((id) => id !== animal.id)
        : [...favorites, animal.id];
      setFavorites(next);
      localStorage.setItem("anipic-favorites", JSON.stringify(next));
    }
  };
  const team = useTeamMessages(user, version, notify);
  const actions = {
    pushUndo: undo.push,
    undoAction: undo.run,
    undoLabel: undo.label,
    undoBusy: undo.busy,
    popupAllowed: !modal,
    teamMessages: team.messages,
    readMessage: team.read,
    notify,
    reload,
    open: setModal,
    close,
    user,
    canEdit,
    canCreate,
    overview,
    updateAssistantAvatar: (url) =>
      setOverview((previous) => ({ ...previous, assistantAvatarUrl: url })),
    version,
    upload,
    favorite,
    favorites,
    animations,
    ui: { ...overview?.interface, enabledModules: modules },
    go,
    editPhoto: (photo) => {
      if (!["admin", "volunteer"].includes(user?.role))
        return notify(
          "La retouche des photos de la bibliothèque est réservée aux administrateurs et bénévoles validés.",
          "error",
        );
      setEditorDraft(photo);
      close();
      go("editor");
    },
    video: (animal) => {
      close();
      setVideoDraft(
        animal?.year ? { year: animal.year } : { animalId: animal?.id },
      );
      go("studio");
    },
    voice: () => {
      setVideoDraft({ voice: true });
      close();
      go("studio");
    },
  };
  useEffect(() => {
    const prefs = overview?.interface;
    if (!prefs) return;
    const d = document.documentElement;
    d.dataset.glass = prefs.glassEnabled ? "on" : "off";
    d.style.setProperty("--glass-blur", `${prefs.glassBlur ?? 16}px`);
    d.style.setProperty("--glass-opacity", `${prefs.glassOpacity ?? 82}%`);
    d.style.setProperty(
      "--glass-saturation",
      `${prefs.glassSaturation ?? 130}%`,
    );
    d.style.setProperty("--tilt-strength", String(prefs.tiltIntensity / 100));
    d.style.setProperty(
      "--reflection-opacity",
      String(prefs.reflectionIntensity / 100),
    );
    d.style.setProperty("--glow-opacity", String(prefs.glowIntensity / 100));
    d.style.setProperty("--card-radius", `${prefs.cardRadius}px`);
    d.style.setProperty(
      "--photo-ratio",
      prefs.photoRatio === "square"
        ? "1"
        : prefs.photoRatio === "portrait"
          ? ".8"
          : "1.333333",
    );
    d.style.setProperty("--grid-columns", String(prefs.gridColumns || 3));
    d.style.setProperty("--grid-gap", `${prefs.gridGap}px`);
    d.style.setProperty("--photo-zoom", String(1 + prefs.photoZoom / 100));
    d.style.setProperty("--glow-color", prefs.glowColor);
    d.style.setProperty("--font-scale", String(prefs.fontScale / 100));
    d.style.setProperty("--motion-speed", String(prefs.motionSpeed / 100));
    d.dataset.cardFacts = prefs.showCardFacts ? "on" : "off";
    d.dataset.photoCounts = prefs.showPhotoCounts ? "on" : "off";
    d.style.setProperty("--accent-custom", prefs.accentColor);
    d.style.setProperty("--accent", prefs.accentColor);
    const rgb = prefs.accentColor
      .slice(1)
      .match(/../g)
      .map((h) => parseInt(h, 16) / 255);
    const linear = rgb.map((v) =>
      v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
    );
    const luminance =
      linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    d.style.setProperty(
      "--accent-ink",
      luminance > 0.179 ? "#000000" : "#ffffff",
    );
    d.dataset.density = prefs.compactUI ? "compact" : "comfortable";
    setTheme(browserTheme() || prefs.themeDefault || "night");
  }, [overview?.interface]);
  useEffect(() => {
    try {
      if (
        !privacy.data?.legal.analyticsEnabled ||
        !privacy.data?.consent.analytics
      ) {
        sessionStorage.removeItem("anipic-visit");
        return;
      }
      let session = sessionStorage.getItem("anipic-visit");
      if (!session) {
        session = uid();
        sessionStorage.setItem("anipic-visit", session);
      }
      api("/visit", {
        method: "POST",
        body: { session, path: "#" + page },
      }).catch(() => {});
    } catch {}
  }, [page, user?.id, privacy.data?.consent.analytics]);
  const admin = pages[page].group === "admin";
  if (["privacy", "terms", "legal"].includes(page))
    return (
      <main className="legal-public">
        <a href="#gallery" onClick={() => go("gallery")}>
          ← AniPic
        </a>
        <LegalPage kind={page} />
        <button onClick={() => setCookiePanel((v) => !v)}>
          Gérer les cookies
        </button>
        {cookiePanel && (
          <CookieChoices
            privacy={privacy}
            onClose={() => setCookiePanel(false)}
          />
        )}
      </main>
    );
  if (gateRequired && !user)
    return (
      <>
        <SiteGate
          preferAccount={modal?.type === "login"}
          session={session}
          notify={notify}
          reload={reload}
          onLogin={login}
        />
        <div className="gate-legal-links">
          <a href="#legal">Mentions légales</a>
          <a href="#privacy">Confidentialité</a>
          <a href="#terms">Conditions d’utilisation</a>
        </div>
      </>
    );
  if (page === "display")
    return (
      <StatusAppearanceContext.Provider
        value={overview?.interface?.statusAppearance}
      >
        <Suspense fallback={<Spinner />}>
          <RefugeScreen />
        </Suspense>
      </StatusAppearanceContext.Provider>
    );
  return (
    <StatusAppearanceContext.Provider
      value={overview?.interface?.statusAppearance}
    >
      <div className="app-shell">
        <aside
          className={`sidebar ${mobile ? "open" : ""}`}
          inert={narrow && !mobile}
        >
          <a
            className="brand"
            href="#gallery"
            onClick={(e) => {
              e.preventDefault();
              go("gallery");
            }}
          >
            <span className="brand-mark">
              <img src="/anipic-icon.svg" alt="Anipic" />
            </span>
            <span>
              AniPic<span className="brand-dot">.</span>
            </span>
          </a>
          <nav aria-label="Navigation principale">
            {[
              [
                "PHOTOTHÈQUE",
                [
                  ...(appRuntime.appMode ? ["mobile", "mobileAdoptions"] : []),
                  "gallery",
                  "animals",
                  "favorites",
                  "collections",
                ],
              ],
              ["PRISE DE VUE", ["todo", "inbox", "print"]],
              [
                "CRÉATION",
                [
                  "studio",
                  "editor",
                  "posters",
                  "groupPoster",
                  "wallpaper",
                  "motion",
                ],
              ],
              [
                "LE REFUGE",
                [
                  "feed",
                  "stats",
                  "tools",
                  "agenda",
                  "volunteers",
                  "writing",
                  "accountHub",
                  "register",
                  "archives",
                  "adoptionReviews",
                  "displaySettings",
                  "broadcasts",
                ],
              ],
              ...(user?.role === "admin"
                ? [
                    [
                      "ADMINISTRATION",
                      ["dashboard", "users", "messages", "visitors", "journal"],
                    ],
                    [
                      "RÉGLAGES",
                      [
                        "settings",
                        "legalSettings",
                        "modules",
                        "api",
                        "sync",
                        "storage",
                        "backups",
                        "migration",
                      ],
                    ],
                  ]
                : []),
            ].map(([label, keys]) => (
              <details
                className="nav-section nav-fold"
                key={label}
                open={
                  navOpen[label] ??
                  (keys.includes(page) || label === "PHOTOTHÈQUE")
                }
                onToggle={(e) => {
                  const isOpen = e.currentTarget.open;
                  setNavOpen((v) => {
                    if (v[label] === isOpen) return v;
                    const next = { ...v, [label]: isOpen };
                    localStorage.setItem("anipic-nav", JSON.stringify(next));
                    return next;
                  });
                }}
              >
                <summary className="nav-label">
                  {label}
                  <ChevronDown size={13} />
                </summary>
                {keys
                  .filter(
                    (key) =>
                      !pages[key].roles ||
                      pages[key].roles.includes(user?.role),
                  )
                  .filter(
                    (key) =>
                      !pageModule(key) || modules[pageModule(key)] !== false,
                  )
                  .filter((key) => key !== "inbox" || canEdit)
                  .filter(
                    (key) =>
                      key !== "register" ||
                      ["admin", "agent"].includes(user?.role),
                  )
                  .map((key) => {
                    const item = pages[key];
                    return (
                      <a
                        key={key}
                        href={"#" + key}
                        className={"nav-item " + (page === key ? "active" : "")}
                        aria-current={page === key ? "page" : undefined}
                        onClick={(e) => {
                          if (
                            e.button === 0 &&
                            !e.ctrlKey &&
                            !e.metaKey &&
                            !e.shiftKey &&
                            !e.altKey
                          ) {
                            e.preventDefault();
                            go(key);
                          }
                        }}
                      >
                        <item.icon {...iconProps} />
                        <span>{item.name}</span>
                        {key === "todo" && overview?.stats.openTasks > 0 && (
                          <span className="nav-count">
                            {overview.stats.openTasks}
                          </span>
                        )}
                        {key === "archives" && overview?.stats.archived > 0 && (
                          <span className="nav-subcount">
                            {overview.stats.archived}
                          </span>
                        )}
                        {key === "adoptionReviews" && pendingAdoptions > 0 && (
                          <span
                            className="nav-count"
                            aria-label={`${pendingAdoptions} adoptions à confirmer`}
                          >
                            {pendingAdoptions}
                          </span>
                        )}
                      </a>
                    );
                  })}
              </details>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className="profile"
              onClick={() =>
                setModal(user ? { type: "account" } : { type: "login" })
              }
            >
              <span className="avatar">
                {user ? <UserPicture user={user} /> : <Users size={18} />}
              </span>
              <span>
                <strong>{user?.name || "Espace équipe"}</strong>
                <small>
                  {user
                    ? {
                        admin: "Administrateur",
                        editor: "Photographe",
                        agent: "Agent SPA",
                        volunteer: "Bénévole",
                        viewer: "Lecteur",
                      }[user.role]
                    : "Se connecter"}
                </small>
              </span>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </aside>
        {mobile && (
          <div className="sidebar-scrim" onClick={() => setMobile(false)} />
        )}
        <main className="main">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="icon-button mobile-menu"
                aria-label="Ouvrir le menu"
                aria-expanded={mobile}
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </button>
              <span>{admin ? "L’atelier" : "Votre espace"}</span>
              <ChevronRight size={13} />
              <strong>{pages[page].name}</strong>
            </div>
            <div className="topbar-right">
              {modules.assistant !== false && (
                <QuickAssistant
                  pages={Object.fromEntries(
                    Object.entries(pages).filter(
                      ([key]) =>
                        !pageModule(key) || modules[pageModule(key)] !== false,
                    ),
                  )}
                  {...actions}
                  hidden={!!modal}
                />
              )}
              <label className="theme-picker">
                <Palette size={15} />
                <select
                  aria-label="Thème visuel"
                  value={theme || "night"}
                  onChange={(e) => {
                    rememberTheme(e.target.value);
                    setTheme(e.target.value);
                  }}
                >
                  <option value="sage">Lumière</option>
                  <option value="spa">SPA · clair & verre</option>
                  <option value="night">Studio nuit</option>
                  <option value="amber">Ambre SPA</option>
                </select>
              </label>
              {session?.demo && (
                <span className="demo-pill">
                  <Sun size={13} />
                  Démonstration
                </span>
              )}
              <span className="status-dot-label">
                <span className="status-dot" />
                Espace {user ? "équipe" : "visiteur"}
              </span>
              <button
                className="avatar top-avatar"
                aria-label="Compte"
                onClick={() =>
                  setModal(user ? { type: "account" } : { type: "login" })
                }
              >
                {user ? <UserPicture user={user} /> : <Users size={16} />}
              </button>
            </div>
          </header>
          <div className="content">
            <AppConnection offline={appRuntime.offline} />
            <AppUpdates />
            {(cookiePanel ||
              (privacy.data?.legal.analyticsEnabled &&
                !privacy.data?.consent.decided)) && (
              <CookieChoices
                privacy={privacy}
                onClose={cookiePanel ? () => setCookiePanel(false) : undefined}
              />
            )}
            {undo.label && (
              <div className="undo-strip" role="status">
                <span>{undo.label}</span>
                <button type="button" onClick={undo.run} disabled={undo.busy}>
                  <Undo2 size={15} /> Annuler <kbd>Ctrl / ⌘ Z</kbd>
                </button>
              </div>
            )}
            {connectionError ? (
              <Empty
                icon={AlertCircle}
                title="Le serveur ne répond pas."
                text={connectionError}
                action={<Button onClick={reload}>Réessayer</Button>}
              />
            ) : !overview ? (
              <Spinner />
            ) : pageModule(page) && modules[pageModule(page)] === false ? (
              <Empty
                title="Module désactivé"
                text="Ce module a été désactivé dans la configuration de cette instance."
              />
            ) : !user &&
              (accessForPage(page, overview.interface?.pageAccess) === "team" ||
                (!publicPosters &&
                  ["posters", "groupPoster"].includes(page))) &&
              page !== "broadcasts" &&
              page !== "stats" ? (
              <Empty
                icon={LockKeyhole}
                title="Page réservée à l’équipe"
                text="Connectez-vous pour consulter cette page."
                action={
                  <Button onClick={() => setModal({ type: "login" })}>
                    Se connecter
                  </Button>
                }
              />
            ) : page === "mobile" ? (
              <MobileHome
                {...actions}
                runtime={appRuntime}
                pendingAdoptions={pendingAdoptions}
              />
            ) : page === "mobileAdoptions" ? (
              <Feed
                {...actions}
                initialKind="adopted"
                title="Les adoptions"
                autoRefresh
              />
            ) : page === "mobilePhotos" ? (
              <Library page="animals" q={q} setQ={setQ} {...actions} />
            ) : page === "displaySettings" ? (
              canManageDisplay(user) ? (
                <Suspense fallback={<Spinner />}>
                  <DisplaySettings {...actions} />
                </Suspense>
              ) : (
                <Empty
                  icon={LockKeyhole}
                  title="Configuration réservée à l’équipe SPA"
                  text="Connectez-vous avec un compte Agent SPA ou Administrateur."
                  action={
                    !user && (
                      <Button
                        onClick={() =>
                          setModal({ type: "login", then: "displaySettings" })
                        }
                      >
                        Se connecter
                      </Button>
                    )
                  }
                />
              )
            ) : page === "visitors" ? (
              user?.role === "admin" ? (
                <Suspense fallback={<Spinner />}>
                  <Visitors />
                </Suspense>
              ) : (
                <Empty
                  title="Accès réservé"
                  text="Connectez-vous avec un compte administrateur."
                />
              )
            ) : page === "volunteers" ||
              page === "writing" ||
              page === "accountHub" ||
              page === "modules" ? (
              <Suspense fallback={<Spinner />}>
                {page === "volunteers" ? (
                  <TeamPlanning {...actions} />
                ) : page === "writing" ? (
                  <WritingStudio {...actions} />
                ) : page === "accountHub" ? (
                  <AccountHub {...actions} />
                ) : user?.role === "admin" ? (
                  <ModuleSettings {...actions} />
                ) : (
                  <Empty title="Accès réservé" />
                )}
              </Suspense>
            ) : page === "legalSettings" ? (
              user?.role === "admin" ? (
                <LegalSettings {...actions} />
              ) : (
                <Empty title="Accès réservé" />
              )
            ) : admin ? (
              user?.role === "admin" ? (
                <Suspense fallback={<Spinner />}>
                  <Admin page={page} {...actions} />
                </Suspense>
              ) : (
                <Empty
                  icon={LockKeyhole}
                  title="Bienvenue dans l’atelier."
                  text="Connectez-vous pour gérer votre photothèque."
                  action={
                    <Button onClick={() => setModal({ type: "login" })}>
                      Se connecter
                    </Button>
                  }
                />
              )
            ) : page === "about" ? (
              <About {...actions} />
            ) : page === "history" ? (
              <RefugeActivity initial="history" {...actions} />
            ) : page === "motion" ? (
              <Suspense fallback={<Spinner />}>
                <MotionStudio {...actions} />
              </Suspense>
            ) : page === "wallpaper" ? (
              <Suspense fallback={<Spinner />}>
                <Wallpaper {...actions} />
              </Suspense>
            ) : page === "editor" ? (
              <Suspense fallback={<Spinner />}>
                <PhotoEditor initial={editorDraft} {...actions} />
              </Suspense>
            ) : page === "stats" ? (
              <Insights {...actions} />
            ) : page === "collections" ? (
              <Collections {...actions} canEdit={canCreate} />
            ) : page === "todo" ? (
              <ShootBoard {...actions} />
            ) : page === "inbox" ? (
              <Inbox {...actions} />
            ) : page === "print" ? (
              <ShootSheet {...actions} />
            ) : page === "posters" ? (
              <Suspense fallback={<Spinner />}>
                {user ? (
                  <BatchPosters {...actions} />
                ) : (
                  <PublicPosters {...actions} />
                )}
              </Suspense>
            ) : page === "register" ? (
              ["admin", "agent"].includes(user?.role) ? (
                <Suspense fallback={<Spinner />}>
                  <InternalRegister {...actions} />
                </Suspense>
              ) : (
                <Empty
                  title="Registre réservé"
                  text="Accès limité aux comptes administration et agent."
                />
              )
            ) : page === "groupPoster" ? (
              <Suspense fallback={<Spinner />}>
                <GroupPoster {...actions} />
              </Suspense>
            ) : page === "adoptionReviews" ? (
              <Suspense fallback={<Spinner />}>
                <AdoptionReviews {...actions} />
              </Suspense>
            ) : page === "tools" ? (
              <AgentTools {...actions} />
            ) : page === "agenda" ? (
              <Suspense fallback={<Spinner />}>
                <Agenda {...actions} />
              </Suspense>
            ) : page === "feed" ? (
              <RefugeActivity {...actions} />
            ) : page === "studio" ? (
              <StudioBoundary>
                <Suspense fallback={<Spinner />}>
                  <Studio
                    initial={videoDraft}
                    {...actions}
                    canEdit={canCreate}
                  />
                </Suspense>
              </StudioBoundary>
            ) : page === "broadcasts" ? (
              <Broadcasts {...actions} />
            ) : (
              <>
                {page === "gallery" && <HomeMessages {...actions} />}
                <Library page={page} q={q} setQ={setQ} {...actions} />
              </>
            )}
            {user && (
              <button
                className="switch-account"
                onClick={async () => {
                  await api("/account/manual", { method: "POST" });
                  setUser(null);
                  setModal({ type: "login" });
                  reload();
                }}
              >
                Changer de compte
              </button>
            )}
            <footer className="footer">
              <button className="footer-about" onClick={() => go("about")}>
                © {new Date().getFullYear()} Gaerisson · À propos
              </button>
              <a className="footer-android" href="/android">
                Installer sur Android
              </a>
              <a href="#legal" onClick={() => go("legal")}>
                Mentions légales
              </a>
              <a href="#terms" onClick={() => go("terms")}>
                Conditions
              </a>
              <a href="#privacy" onClick={() => go("privacy")}>
                Confidentialité
              </a>
              <button onClick={() => setCookiePanel(true)}>Cookies</button>
              <QuickTour go={go} user={user} />
              <span>
                {session?.demo
                  ? "Démonstration · Profils fictifs / photos d’illustration"
                  : "Anipic"}{" "}
              </span>
            </footer>
          </div>
        </main>
        {appRuntime.appMode && !modal && (
          <AppBottomNav
            page={page}
            go={go}
            more={() => (narrow ? setMobile((v) => !v) : go("tools"))}
            expanded={mobile}
            modules={modules}
          />
        )}
        {toast && (
          <div role="status" className={`toast ${toast.type}`}>
            <span>
              {toast.type === "error" ? (
                <AlertCircle size={19} />
              ) : (
                <CheckCircle2 size={19} />
              )}
            </span>
            {toast.message}
            <button
              className="icon-button"
              onClick={() => setToast(null)}
              aria-label="Fermer la notification"
            >
              <X size={15} />
            </button>
          </div>
        )}
        {modal?.type === "login" && (
          <Login
            onClose={close}
            session={session}
            onLogin={(u) => login(u, modal.then)}
            notify={notify}
          />
        )}
        {modal?.type === "animal" && (
          <AnimalDetail animalId={modal.id} {...actions} />
        )}
        {modal?.type === "reassign-photos" && canEdit && (
          <PhotoAssignmentDialog
            mode="reassign"
            photos={modal.photos}
            sourceAnimal={modal.animal}
            pushUndo={undo.push}
            notify={notify}
            close={() => setModal({ type: "animal", id: modal.animal.id })}
            done={(animal) => {
              setModal({ type: "animal", id: animal.id });
              reload();
            }}
          />
        )}
        {modal?.type === "download" && (
          <DownloadDialog
            photoId={modal.photoId}
            animal={modal.animal}
            {...actions}
          />
        )}
        {modal?.type === "canva" && canCreate && (
          <CanvaDialog
            animalId={modal.animalId}
            photoId={modal.photoId}
            {...actions}
          />
        )}
        {modal?.type === "communication" && (
          <CommunicationDialog
            animalId={modal.animalId}
            photoId={modal.photoId}
            photoIds={modal.photoIds}
            {...actions}
          />
        )}
        {modal?.type === "task" && (
          <TaskForm animal={modal.animal} {...actions} />
        )}
        {modal?.type === "post" && (
          <SocialDraft
            animal={modal.animal}
            photoId={modal.photoId}
            {...actions}
          />
        )}
        {modal?.type === "upload" && (
          <UploadForm animalId={modal.id} {...actions} />
        )}
        {modal?.type === "collection" && (
          <CollectionForm
            photoIds={modal.photoIds || []}
            parentId={modal.parentId}
            {...actions}
          />
        )}
        {modal?.type === "album-photo" && (
          <AlbumPhoto
            album={modal.album}
            photos={modal.photos}
            index={modal.index}
            {...actions}
            canEdit={canCreate}
          />
        )}
        {modal?.type === "collection-view" && (
          <CollectionView
            collection={modal.collection}
            {...actions}
            canEdit={canCreate}
          />
        )}
        {modal?.type === "account" && (
          <Account
            {...actions}
            onLogout={async () => {
              try {
                await api("/logout", { method: "POST" });
                setUser(null);
                setCsrf("");
                close();
                setPage("gallery");
                location.hash = "gallery";
                reload();
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          />
        )}
      </div>
    </StatusAppearanceContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<App />);

import "./update32.css";
import "./update33.css";
import "./update34.css";
import "./update35.css";
import "./update36.css";
import "./update39.css";
import "./update312.css";
import "./update314.css";
import "./mobile-app.css";
import "./update3110.css";
