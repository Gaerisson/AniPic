import { AnimalStatus } from "./animal-status.jsx";
import { statusDefaults } from "../shared/animal-status.mjs";
import { Button } from "./ui.jsx";
export function StatusSettings({ value = statusDefaults, change }) {
  const update = (key, field, next) =>
    change({
      ...value,
      [key]: { ...value[key], [field]: next },
    });
  return (
    <section className="panel status-settings-panel">
      <div className="status-settings-heading">
        <div>
          <h2>Statuts des animaux</h2>
          <p className="fineprint">
            Personnalisez les badges et les filtres. Le statut reçu de la SPA
            reste conservé.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => change(structuredClone(statusDefaults))}
        >
          Réinitialiser les statuts
        </Button>
      </div>
      <div className="status-settings-grid">
        {Object.entries(statusDefaults).map(([key, defaults]) => {
          const configured = value[key] || defaults;
          return (
            <div className="status-setting" key={key}>
              <header>
                <strong>{defaults.label}</strong>
                <AnimalStatus status={key} appearance={value} />
              </header>
              <label htmlFor={`status-label-${key}`}>
                Texte affiché
                <input
                  id={`status-label-${key}`}
                  aria-label={`Texte du statut ${defaults.label}`}
                  value={configured.label}
                  required
                  maxLength={32}
                  onChange={(e) => update(key, "label", e.target.value)}
                />
              </label>
              <div className="status-color-field">
                <span>Couleur</span>
                <div className="status-color-control">
                  <input
                    type="color"
                    aria-label={`Couleur du statut ${defaults.label}`}
                    value={
                      /^#[a-fA-F0-9]{6}$/.test(configured.color)
                        ? configured.color
                        : defaults.color
                    }
                    onChange={(e) => update(key, "color", e.target.value)}
                  />
                  <input
                    aria-label={`Code couleur du statut ${defaults.label}`}
                    value={configured.color}
                    required
                    pattern="#[a-fA-F0-9]{6}"
                    maxLength={7}
                    onChange={(e) => update(key, "color", e.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
