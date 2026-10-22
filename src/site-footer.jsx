import { QuickTour } from "./quick-tour.jsx";
import { NavLink } from "./nav-link.jsx";
export function SiteFooter({ go, user, demo, appMode, onCookies }) {
  return (
    <footer className="footer footer313">
      <div className="footer-main">
        <button className="footer-about" onClick={() => go("about")}>
          <img src="/anipic-icon.svg" alt="" />
          <span>
            <strong>AniPic</strong>
            <small>© {new Date().getFullYear()} Gaerisson · À propos</small>
          </span>
        </button>
        <div className="footer-help">
          <a href="/android">Installer sur Android ↗</a>
          <QuickTour go={go} user={user} appMode={appMode} />
        </div>
      </div>
      <nav
        className="footer-links"
        aria-label="Informations et confidentialité"
      >
        <NavLink href="#legal" onClick={() => go("legal")}>
          Mentions légales
        </NavLink>
        <NavLink href="#terms" onClick={() => go("terms")}>
          Conditions
        </NavLink>
        <NavLink href="#privacy" onClick={() => go("privacy")}>
          Confidentialité
        </NavLink>
        <button onClick={onCookies}>Cookies</button>
        <span>
          {demo
            ? "Démonstration · Profils fictifs et photos d’illustration"
            : "Un outil au service du refuge."}
        </span>
      </nav>
    </footer>
  );
}
