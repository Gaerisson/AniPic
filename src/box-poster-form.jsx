import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function BoxPosterForm({ animalId, refPhoto, notify, onSaved }) {
  const [location, setLocation] = useState(""),
    [state, setState] = useState("printed"),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/creative/box-posters", {
            method: "POST",
            body: {
              animalId,
              location,
              state,
              ...(refPhoto ? { ref: refPhoto } : {}),
            },
          });
          notify("Affiche ajoutée au suivi des box.");
          setLocation("");
          onSaved?.();
        } catch (error) {
          notify(error.message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>À renseigner après impression ou installation effective.</p>
      <label>
        Emplacement
        <input
          required
          maxLength={100}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Box 12 · Couloir chiens…"
        />
      </label>
      <label>
        État
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="printed">Imprimée · à installer</option>
          <option value="installed">Installée dans le box</option>
        </select>
      </label>
      <Button icon={ClipboardCheck} disabled={busy}>
        {busy ? "Enregistrement…" : "Ajouter au suivi"}
      </Button>
    </form>
  );
}
