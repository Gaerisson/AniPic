import { useRef } from "react";
export function FoxAvatar({
  interactive = false,
  className = "",
  decorative = false,
  src = "/gaerisson-avatar.png",
  alt = "Renard · avatar GitHub de Gaerisson",
}) {
  const frame = useRef(null);
  function reset(e) {
    cancelAnimationFrame(frame.current);
    e.currentTarget.style.removeProperty("--fox-x");
    e.currentTarget.style.removeProperty("--fox-y");
  }
  return (
    <span
      className={`fox-avatar ${interactive ? "fox-interactive" : ""} ${className}`}
      onPointerMove={
        interactive
          ? (e) => {
              if (
                e.pointerType === "touch" ||
                document.documentElement.dataset.motion === "off" ||
                matchMedia("(prefers-reduced-motion: reduce)").matches
              )
                return;
              const el = e.currentTarget,
                rect = el.getBoundingClientRect(),
                x = (e.clientX - rect.left) / rect.width - 0.5,
                y = (e.clientY - rect.top) / rect.height - 0.5;
              cancelAnimationFrame(frame.current);
              frame.current = requestAnimationFrame(() => {
                el.style.setProperty("--fox-x", `${-y * 10}deg`);
                el.style.setProperty("--fox-y", `${x * 10}deg`);
              });
            }
          : undefined
      }
      onPointerLeave={interactive ? reset : undefined}
    >
      <img
        key={src}
        src={src || "/gaerisson-avatar.png"}
        alt={decorative ? "" : alt}
        onError={(e) => {
          e.currentTarget.onerror = null;
          if (!e.currentTarget.src.endsWith("/gaerisson-avatar.png"))
            e.currentTarget.src = "/gaerisson-avatar.png";
        }}
        draggable="false"
      />
      <i aria-hidden="true" />
    </span>
  );
}
