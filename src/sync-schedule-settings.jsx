import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { nextSyncDates } from "../shared/sync-schedule.mjs";
export function SyncScheduleSettings({ values: v, change }) {
  const mode =
    v.syncScheduleMode === "interval" && !v.syncIntervalHours
      ? "manual"
      : v.syncScheduleMode || "manual";
  const preview = useMemo(() => {
    try {
      return { dates: nextSyncDates({ ...v, syncScheduleMode: mode }) };
    } catch (e) {
      return { error: e.message };
    }
  }, [mode, v.syncCron, v.syncTimeZone, v.syncIntervalHours]);
  return (
    <section className="panel sync-schedule-settings">
      <h2>
        <CalendarClock size={20} /> Synchronisation automatique
      </h2>
      <div className="form-row">
        <label>
          Planification
          <select
            value={mode}
            onChange={(e) =>
              change({
                syncScheduleMode: e.target.value,
                ...(e.target.value === "interval"
                  ? { syncIntervalHours: v.syncIntervalHours || 6 }
                  : {}),
              })
            }
          >
            <option value="manual">Manuelle</option>
            <option value="interval">À intervalle régulier</option>
            <option value="cron">Calendrier cron</option>
          </select>
        </label>
        {mode === "interval" && (
          <label>
            Intervalle en minutes
            <input
              type="number"
              min="15"
              max="10080"
              step="15"
              value={(v.syncIntervalHours || 0) * 60}
              onChange={(e) =>
                change("syncIntervalHours", Number(e.target.value) / 60)
              }
            />
          </label>
        )}
        {mode === "cron" && (
          <label>
            Fuseau horaire
            <input
              value={v.syncTimeZone}
              maxLength="80"
              placeholder="Europe/Paris"
              onChange={(e) => change("syncTimeZone", e.target.value)}
            />
          </label>
        )}
      </div>
      {mode === "cron" && (
        <>
          <label>
            Expression cron
            <input
              className="cron-input"
              value={v.syncCron}
              maxLength="100"
              placeholder="0 8,14,20 * * *"
              onChange={(e) => change("syncCron", e.target.value)}
              aria-describedby="cron-help"
            />
          </label>
          <small id="cron-help">
            Minute · heure · jour du mois · mois · jour de semaine (0/7 =
            dimanche)
          </small>
          <div className="schedule-presets">
            {[
              ["Toutes les 6 h", "0 */6 * * *"],
              ["8 h · 14 h · 20 h", "0 8,14,20 * * *"],
              ["Semaine à 9 h", "0 9 * * 1-5"],
            ].map(([label, expression]) => (
              <button
                type="button"
                key={expression}
                onClick={() => change("syncCron", expression)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {preview.error ? (
        <p className="error-text" role="alert">
          {preview.error}
        </p>
      ) : (
        mode !== "manual" && (
          <div className="schedule-preview">
            <strong>
              {mode === "cron"
                ? "Prochains passages · aperçu sur 8 jours"
                : "Cadence à partir de maintenant"}
            </strong>
            <div>
              {preview.dates.length ? (
                preview.dates.map((date) => (
                  <time key={date} dateTime={date}>
                    {new Date(date).toLocaleString("fr-FR", {
                      timeZone: v.syncTimeZone || "Europe/Paris",
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                ))
              ) : (
                <span>Aucun passage prévu sur ces huit jours.</span>
              )}
            </div>
          </div>
        )
      )}
      <p className="fineprint">
        {mode === "manual"
          ? "La synchronisation démarre uniquement à votre demande."
          : "Exécuté côté serveur, même navigateur fermé. Enregistrez ces réglages pour activer la planification."}
        {v.sourceMode === "disabled" &&
          " Activez également une source pour permettre les passages automatiques."}
      </p>
    </section>
  );
}
