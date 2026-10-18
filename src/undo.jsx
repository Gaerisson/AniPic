import { useState, useEffect, useRef } from "react";
import { isUndoShortcut } from "../shared/undo-shortcut.mjs";
export function useUndo(user, notify, reload) {
  const [stack, setStack] = useState([]),
    [busy, setBusy] = useState(false),
    current = useRef([]),
    busyRef = useRef(false);
  const push = (entry) => {
    current.current = [...current.current, entry].slice(-30);
    setStack(current.current);
  };
  const run = async () => {
    const item = current.current.at(-1);
    if (!item || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await item.run(item.revision);
      current.current = current.current.slice(0, -1);
      if (item.key && response?.updatedAt) {
        const previous = current.current.findLast(
          (entry) => entry.key === item.key,
        );
        // Continue our own chain only when no intervening version was observed.
        if (previous?.revision === item.previousRevision) {
          current.current = current.current.map((entry) =>
            entry === previous
              ? { ...entry, revision: response.updatedAt }
              : entry,
          );
        }
      }
      setStack(current.current);
      notify(item.successMessage || "Action annulée.");
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const action = useRef(run);
  action.current = run;
  useEffect(() => {
    current.current = [];
    setStack([]);
  }, [user?.id]);
  useEffect(() => {
    const key = (e) => {
      if (isUndoShortcut(e)) {
        if (current.current.length) {
          e.preventDefault();
          action.current();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return { push, run, busy, label: stack.at(-1)?.label };
}
