import { NavLink } from "./nav-link.jsx";
export function CreationNav({ page, go, modules = {} }) {
  const items = [
    ["canvas", "Atelier Canvas", "posters"],
    ["posters", "Fiches de box", "posters"],
    ["groupPoster", "Affiches collectives", "posters"],
    ["wallpaper", "Visuels & bannières", "posters"],
    ["studio", "Studio vidéo", "video"],
    ["motion", "Fonds animés", "video"],
  ];
  return (
    <nav className="creation-nav" aria-label="Outils de création">
      {items
        .filter(([, , m]) => modules[m] !== false)
        .map(([p, n]) => (
          <NavLink
            key={p}
            href={"#" + p}
            aria-current={page === p ? "page" : undefined}
            onClick={() => go(p)}
          >
            {n}
          </NavLink>
        ))}
    </nav>
  );
}
