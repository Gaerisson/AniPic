import { useEffect, useState } from "react";
import {
  Heart,
  Images,
  Tv,
  House,
  Menu,
  ArrowUpRight,
  Download,
  WifiOff,
  ShieldCheck,
  Check,
  Smartphone,
} from "lucide-react";
import { mobileAppLayout, mobileDestinations } from "../shared/mobile-app.mjs";
import { Button } from "./ui.jsx";
import { NavLink } from "./nav-link.jsx";

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
            "L’installation automatique est indisponible dans ce navigateur. Utilisez le menu de Chrome pour installer AniPic.",
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
      setInstallError(
        "Installation annulée ou indisponible. Vous pouvez réessayer depuis le menu du navigateur.",
      );
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

const icons = { home: House, heart: Heart, photos: Images, tv: Tv };
export function AppBottomNav({ page, go, more, expanded }) {
  return (
    <nav className="app-bottom-nav" aria-label="Navigation de l’application">
      {mobileDestinations.map((d) => {
        const Icon = icons[d.symbol],
          active =
            page === d.page ||
            (d.page === "mobileAdoptions" && page === "adoptionReviews");
        return (
          <NavLink
            href={`#${d.page}`}
            key={d.page}
            aria-current={active ? "page" : undefined}
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
}) {
  const canReview = ["admin", "agent"].includes(user?.role),
    pending = pendingAdoptions ?? overview?.stats?.pendingAdoptions ?? 0;
  return (
    <div className="mobile-home">
      <section className="mobile-welcome">
        <img src="/anipic-icon.svg" alt="AniPic" />
        <div className="eyebrow">LE REFUGE, AVEC VOUS</div>
        <h1>
          Des nouvelles.
          <br />
          Des regards.
          <br />
          <em>De belles histoires.</em>
        </h1>
        <p>
          {overview?.refugeName || "Votre refuge"} · AniPic vous accompagne sur
          votre téléphone.
        </p>
      </section>
      <div className="mobile-destination-grid">
        {[
          {
            page: "mobileAdoptions",
            name: "Les adoptions",
            text: "Les départs, les confirmations et les belles nouvelles.",
            Icon: Heart,
          },
          {
            page: "mobilePhotos",
            name: "Les photos",
            text: "Retrouver un compagnon, ses portraits et son album.",
            Icon: Images,
          },
          {
            page: "broadcasts",
            name: "Vidéo C8",
            text: "Vos émissions, la reprise de lecture et le plein écran.",
            Icon: Tv,
          },
        ].map(({ page, name, text, Icon }) => (
          <NavLink
            key={page}
            href={`#${page}`}
            onClick={() => go(page)}
            className={`panel mobile-destination destination-${page}`}
          >
            <Icon size={27} />
            <div>
              <strong>{name}</strong>
              <p>{text}</p>
            </div>
            <ArrowUpRight size={20} />
          </NavLink>
        ))}
      </div>
      {canReview && (
        <section className="panel mobile-review">
          <span className="mobile-review-count">
            {pending > 0 ? pending : <Check size={24} />}
          </span>
          <div>
            <h2>
              {pending
                ? "Adoptions à confirmer"
                : "Les validations sont à jour"}
            </h2>
            <p>
              {pending
                ? "Les départs ont été détectés automatiquement. L’équipe peut confirmer leur adoption."
                : "Retrouvez ici les prochains départs automatiques à vérifier."}
            </p>
          </div>
          <Button variant="secondary" onClick={() => go("adoptionReviews")}>
            Voir la liste
          </Button>
        </section>
      )}
      {!user && (
        <section className="panel mobile-account">
          <ShieldCheck size={24} />
          <div>
            <h2>Votre espace équipe</h2>
            <p>
              Connectez-vous pour retrouver les outils autorisés pour votre
              compte et les émissions réservées à l’équipe.
            </p>
          </div>
          <Button onClick={() => open({ type: "login" })}>Se connecter</Button>
        </section>
      )}
      {!runtime.installed && (
        <section className="panel mobile-install">
          <Smartphone size={24} />
          <div>
            <h2>Une place sur votre écran d’accueil.</h2>
            <p>
              {runtime.canInstall
                ? "Installez AniPic pour l’ouvrir dans sa propre fenêtre avec son icône."
                : "Sur Android, ouvrez le menu de Chrome puis « Installer l’application » ou « Ajouter à l’écran d’accueil ». L’installation nécessite le site en HTTPS."}
            </p>
            {runtime.installError && (
              <p role="status">{runtime.installError}</p>
            )}
            <a className="mobile-apk-link" href="/android">
              <Download size={14} /> Télécharger l’APK Android
            </a>
          </div>
          {runtime.canInstall && (
            <Button onClick={runtime.install}>
              <Download size={17} />
              Installer AniPic
            </Button>
          )}
        </section>
      )}
      <p className="mobile-data-note">
        Les données restent sur votre serveur AniPic. Les droits de votre compte
        et le code d’accès du refuge restent appliqués.
      </p>
    </div>
  );
}
export function AppConnection({ offline }) {
  return offline ? (
    <div role="status" className="app-offline-banner">
      <WifiOff size={16} />
      Appareil hors connexion · les actions nécessitent le serveur AniPic.
    </div>
  ) : null;
}
