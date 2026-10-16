import {
  priorityLabels,
  photoRuleDefaults,
} from "../shared/photo-priority.mjs";
export function PhotoRulesSettings({ value = photoRuleDefaults, onChange }) {
  return (
    <section className="panel photo-rules-settings">
      <h2>Priorités des photos</h2>
      <p className="fineprint">
        Classement des animaux sans photo locale et priorité proposée lors d’une
        nouvelle demande.
      </p>
      <div className="form-row">
        {[
          ["sos", "Animal SOS"],
          ["standard", "Autres animaux"],
          ["reserved", "Animal réservé"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            >
              {Object.entries(priorityLabels).map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <small>
        SOS est évalué en premier. Les demandes déjà créées gardent la priorité
        choisie par l’équipe.
      </small>
    </section>
  );
}
