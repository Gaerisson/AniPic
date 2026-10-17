import { useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { api, imageUrl, date } from "./api.js";
import { Button } from "./ui.jsx";
export function PhotoTrash({ animalId, notify, reload }) {
  const [items, setItems] = useState(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setItems(
        await api("/photo-trash" + (animalId ? "?animalId=" + animalId : "")),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <details
      className="panel photo-trash"
      onToggle={(e) => {
        if (e.currentTarget.open) load();
      }}
    >
      <summary>
        <Trash2 size={16} /> Corbeille des photos · restaurables
      </summary>
      <p className="small-note">
        Les originaux restent dans le stockage et dans les sauvegardes.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="trash-grid">
        {items?.map((p) => (
          <article key={p.id}>
            <img src={imageUrl(p.id, 320)} alt={p.filename} />
            <strong>{p.name}</strong>
            <small>
              {p.filename} · {date(p.deleted_at)}
            </small>
            <Button
              type="button"
              variant="secondary"
              icon={Undo2}
              onClick={async () => {
                try {
                  await api("/photos/" + p.id, {
                    method: "PATCH",
                    body: { deleted: false },
                  });
                  await load();
                  reload();
                  notify("Photo restaurée.");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Restaurer
            </Button>
          </article>
        ))}
      </div>
      {items && !items.length && <p>La corbeille est vide.</p>}
    </details>
  );
}
