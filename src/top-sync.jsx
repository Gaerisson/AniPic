import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
import { syncJobState } from "../shared/sync-job-state.mjs";

export function TopSync({ user, notify, reload }) {
  const [job, setJob] = useState(null),
    [starting, setStarting] = useState(false);
  const tracked = useRef(null),
    request = useRef(0),
    mounted = useRef(false),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (user?.role !== "admin") {
      setJob(null);
      return () => {
        mounted.current = false;
      };
    }
    let active = true,
      loading = false;
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true;
      const revision = ++request.current;
      try {
        const jobs = await api("/admin/jobs");
        if (!active || revision !== request.current) return;
        const state = syncJobState(jobs, tracked.current);
        if (state.state === "running") {
          tracked.current = state.job.id;
          setJob(state.job);
        } else if (state.state === "missing") {
          tracked.current = null;
          setJob(null);
          reload();
          notify(
            "Ce suivi n’est plus disponible. Consultez Synchronisation pour vérifier le résultat.",
            "error",
          );
        } else if (tracked.current) {
          const ended = state.job;
          if (ended && ended.state !== "running") {
            tracked.current = null;
            setJob(null);
            reload();
            let partial = false;
            try {
              partial = JSON.parse(ended.detail).complete === false;
            } catch {}
            notify(
              ended.state === "done"
                ? partial
                  ? "Collecte partielle : consultez Synchronisation."
                  : "Synchronisation terminée."
                : "La synchronisation a échoué. Consultez le journal.",
              ended.state === "done" && !partial ? "success" : "error",
            );
          }
        }
      } catch {
      } finally {
        loading = false;
      }
    };
    load();
    const timer = setInterval(load, job?.id ? 2000 : 15000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [user?.id, user?.role, job?.id]);
  if (user?.role !== "admin") return null;
  const busy = starting || !!job;
  return (
    <Button
      variant="secondary"
      icon={RefreshCw}
      className={`top-sync ${busy ? "is-syncing" : ""}`}
      disabled={busy}
      title="Importer la liste SPA maintenant"
      onClick={async () => {
        if (pending.current || job) return;
        pending.current = true;
        setStarting(true);
        request.current++;
        try {
          const result = await api("/admin/sync", { method: "POST" });
          if (mounted.current) {
            tracked.current = result.id;
            setJob({ id: result.id, state: "running" });
          }
        } catch (e) {
          if (mounted.current) notify(e.message, "error");
        } finally {
          pending.current = false;
          if (mounted.current) setStarting(false);
        }
      }}
    >
      {busy ? "Synchronisation…" : "Synchroniser"}
    </Button>
  );
}
