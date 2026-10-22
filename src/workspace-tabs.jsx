import { workspaceFor } from "../shared/workspaces.mjs";
import { NavLink } from "./nav-link.jsx";
export function WorkspaceTabs({ page, go, user, appMode }) {
  const group = workspaceFor(page);
  if (!group || (group.admin && user?.role !== "admin")) return null;
  const items = group.pages.filter(
    ([key]) =>
      (key !== "appOptions" || appMode) &&
      (key !== "inbox" || ["admin", "editor", "agent"].includes(user?.role)),
  );
  return (
    <nav className="workspace-tabs" aria-label={group.label}>
      {items.map(([key, label]) => (
        <NavLink
          key={key}
          href={"#" + key}
          onClick={() => go(key)}
          aria-current={page === key ? "page" : undefined}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
