import { useEffect, useRef, useState, useCallback } from "react";
import {
  displayIdentity,
  playbackTelemetry,
  postDisplayHeartbeat,
  displayHeartbeatMs,
} from "./display-monitor-client.mjs";
function identity(reset = false) {
  let local, session;
  try {
    local = window.localStorage;
  } catch {}
  try {
    session = window.sessionStorage;
  } catch {}
  return displayIdentity({ local, session, reset });
}
export function useDisplayMonitor() {
  const tracker = useRef(null),
    device = useRef(null),
    sendRef = useRef(() => {}),
    pending = useRef(null),
    lastState = useRef(""),
    [generation, setGeneration] = useState(0),
    [connection, setConnection] = useState({ name: "", state: "starting" });
  if (!tracker.current) tracker.current = playbackTelemetry();
  const queueSend = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = setTimeout(() => sendRef.current(), 100);
  }, []);
  const onStatus = useCallback(
    (status) => {
      tracker.current.player(status);
      const signature = JSON.stringify([status.state, status.issues]);
      if (signature !== lastState.current) {
        lastState.current = signature;
        queueSend();
      }
    },
    [queueSend],
  );
  const sync = useCallback(
    (show) => {
      tracker.current.sync();
      if (!show.enabled)
        onStatus({
          state: "disabled",
          revision: show.revision,
          scene: null,
          issues: [],
          cursor: null,
        });
    },
    [onStatus],
  );
  const failed = useCallback(() => {
    tracker.current.failed();
    queueSend();
  }, [queueSend]);
  useEffect(() => {
    let stopped = false,
      inFlight = false,
      revoked = false;
    try {
      if (!device.current) device.current = identity();
    } catch {
      setConnection({ name: "", state: "unavailable" });
      return;
    }
    const send = async () => {
      if (stopped || inFlight || revoked) return;
      inFlight = true;
      try {
        const status = tracker.current.snapshot({
          visible: document.visibilityState !== "hidden",
          fullscreen: !!document.fullscreenElement,
          width: Math.min(32000, Math.max(0, Math.round(window.innerWidth))),
          height: Math.min(32000, Math.max(0, Math.round(window.innerHeight))),
        });
        const result = await postDisplayHeartbeat(device.current, status);
        if (!stopped) setConnection({ name: result.name, state: "connected" });
      } catch (e) {
        if (!stopped) {
          revoked = e.status === 410;
          setConnection((previous) => ({
            ...previous,
            state: revoked ? "revoked" : "unavailable",
          }));
        }
      } finally {
        inFlight = false;
      }
    };
    sendRef.current = send;
    send();
    const timer = setInterval(send, displayHeartbeatMs);
    document.addEventListener("visibilitychange", send);
    document.addEventListener("fullscreenchange", send);
    return () => {
      stopped = true;
      clearTimeout(pending.current);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", send);
      document.removeEventListener("fullscreenchange", send);
      sendRef.current = () => {};
    };
  }, [generation]);
  return {
    onStatus,
    sync,
    failed,
    connection,
    restart: () => {
      try {
        device.current = identity(true);
        setConnection({ name: "", state: "starting" });
        setGeneration((n) => n + 1);
      } catch {
        setConnection({ name: "", state: "unavailable" });
      }
    },
  };
}
export function DisplayMonitorControl({ monitor }) {
  return monitor.connection.state === "revoked" ? (
    <button type="button" onClick={monitor.restart}>
      Réactiver le suivi TV
    </button>
  ) : (
    <span
      className="tv-monitor-control"
      title={
        monitor.connection.state === "connected"
          ? "Cet écran transmet son état de lecture."
          : "Le suivi reprendra quand le serveur sera accessible."
      }
    >
      {monitor.connection.state === "connected"
        ? monitor.connection.name
        : "Suivi TV · connexion…"}
    </span>
  );
}
