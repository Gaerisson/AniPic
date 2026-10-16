import { Trash2, Undo2 } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function StudioTrash({ trash, canEdit, refresh, notify }) {
  const rows = [
    ...trash.projects.map((p) => ({ ...p, kind: "projects", label: "Projet" })),
    ...trash.renders.map((p) => ({ ...p, kind: "renders", label: "Export" })),
  ];
  return (
    <details className="panel studio-trash">
      <summary>
        <Trash2 size={17} />
        Corbeille du studio <span>{rows.length}</span>
      </summary>
      <p>
        La suppression retire l’élément des listes. Vous pouvez le restaurer ici
        ; les photos originales restent conservées.
      </p>
      {rows.map((row) => (
        <div key={row.id}>
          <span>
            <strong>{row.title}</strong>
            <small>{row.label}</small>
          </span>
          <Button
            variant="secondary"
            icon={Undo2}
            disabled={!canEdit}
            onClick={async () => {
              try {
                await api(`/video/${row.kind}/${row.id}/restore`, {
                  method: "POST",
                });
                await refresh();
                notify("Élément restauré.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            Restaurer
          </Button>
        </div>
      ))}
    </details>
  );
}
