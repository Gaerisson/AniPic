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
  const started = useRef(performance.now()),
    reconnections = useRef(0);
  const tracker = useRef(null),
    device = useRef(null),
    sendRef = useRef(() => {}),
    pending = useRef(null),
    lastState = useRef(""),
    [generation, setGeneration] = useState(0),
    [config, setConfig] = useState(null),
    [connection, setConnection] = useState({ name: "", state: "starting" });
  if (!tracker.current) tracker.current = playbackTelemetry();
  const queueSend = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = setTimeout(() => sendRef.current(), 100);
  }, []);
  const onStatus = useCallback(
    (status) => {
      tracker.current.player(status);
      window.dispatchEvent(
        new CustomEvent("anipic-tv-playback", { detail: status }),
      );
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
    let processing = false;
    const handleCommands = async (result) => {
      if (processing || stopped || revoked) return;
      processing = true;
      try {
        for (const command of result.commands || []) {
          let image;
          if (command.kind === "snapshot" && result.config?.captureEnabled) {
            try {
              // Capture the composition itself. Its parent is positioned and
              // scaled to the TV viewport; cloning it offsets the screenshot.
              const stage = document.querySelector(
                ".show-full .show-stage",
              )?.firstElementChild;
              if (stage) {
                const { toJpeg } = await import("html-to-image");
                image = await toJpeg(stage, {
                  width: stage.clientWidth,
                  height: stage.clientHeight,
                  quality: 0.75,
                  canvasWidth: 960,
                  canvasHeight: Math.round(
                    (960 * stage.clientHeight) / stage.clientWidth,
                  ),
                  pixelRatio: 1,
                  skipFonts: true,
                  style: {
                    transform: "none",
                    position: "relative",
                    top: "0",
                    left: "0",
                  },
                });
              }
            } catch {}
          }
          const response = await fetch("/api/public/display/command-result", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: device.current.id,
              token: device.current.token,
              command: command.id,
              ...(image ? { image } : {}),
            }),
          });
          if (response.ok && command.kind === "refresh")
            window.dispatchEvent(new Event("anipic-tv-refresh"));
        }
      } finally {
        processing = false;
      }
    };
    let polling = false;
    const poll = async () => {
      if (stopped || revoked || polling || connection?.state === "revoked")
        return;
      polling = true;
      try {
        const response = await fetch("/api/public/display/poll", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: device.current.id,
            token: device.current.token,
          }),
        });
        if (response.ok) {
          const result = await response.json();
          if (!stopped) {
            setConfig((previous) =>
              JSON.stringify(previous) === JSON.stringify(result.config)
                ? previous
                : result.config,
            );
            await handleCommands(result);
          }
        }
      } catch {
      } finally {
        polling = false;
      }
    };
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
        status.telemetry = {
          uptimeSeconds: Math.min(
            315360000,
            Math.floor((performance.now() - started.current) / 1000),
          ),
          pixelRatio: Math.max(0.1, Math.min(10, devicePixelRatio || 1)),
          online: navigator.onLine,
          network: String(
            navigator.connection?.effectiveType || "Non précisé",
          ).slice(0, 20),
          reconnections: Math.min(100000, reconnections.current),
        };
        const result = await postDisplayHeartbeat(device.current, status);
        if (!stopped) {
          setConnection({ name: result.name, state: "connected" });
          setConfig((previous) =>
            JSON.stringify(previous) === JSON.stringify(result.config)
              ? previous
              : result.config,
          );
          await handleCommands(result);
        }
      } catch (e) {
        if (!stopped) {
          revoked = e.status === 403;
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
    const pollTimer = setInterval(poll, 2000);
    const reconnected = () => {
      reconnections.current++;
      send();
    };
    window.addEventListener("online", reconnected);
    document.addEventListener("visibilitychange", send);
    document.addEventListener("fullscreenchange", send);
    return () => {
      stopped = true;
      clearTimeout(pending.current);
      clearInterval(timer);
      clearInterval(pollTimer);
      window.removeEventListener("online", reconnected);
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
    config,
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
