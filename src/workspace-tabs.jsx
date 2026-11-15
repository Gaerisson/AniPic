import { workspaceFor } from "../shared/workspaces.mjs";
import { NavLink } from "./nav-link.jsx";
import { pageModule } from "../shared/modules.mjs";
export function WorkspaceTabs({
  page,
  go,
  user,
  appMode,
  modules = {},
  inboxCount = 0,
}) {
  const group = workspaceFor(page);
  if (!group || (group.admin && user?.role !== "admin")) return null;
  const items = group.pages.filter(
    ([key]) =>
      (key !== "appOptions" || appMode) &&
      (!pageModule(key) || modules[pageModule(key)] !== false) &&
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
          {key === "inbox" && inboxCount > 0 && (
            <span
              className="nav-count"
              aria-label={`${inboxCount} photos à attribuer`}
            >
              {inboxCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
