import { useRef, useEffect } from "react";
import { MoreHorizontal, ChevronDown, LoaderCircle } from "lucide-react";
export function ActionMenu({
  label = "Actions",
  children,
  className = "",
  busy = false,
}) {
  const ref = useRef();
  const panel = useRef();
  const place = () => {
    if (!ref.current?.open || !panel.current) return;
    const trigger = ref.current
        .querySelector("summary")
        .getBoundingClientRect(),
      height = window.innerHeight,
      width = Math.min(320, window.innerWidth - 24),
      below = height - trigger.bottom - 12,
      above = trigger.top - 12,
      upwards = below < 240 && above > below,
      available = Math.max(80, upwards ? above : below);
    Object.assign(panel.current.style, {
      width: `${width}px`,
      maxHeight: `${Math.min(available, 480)}px`,
      left: `${Math.max(12, Math.min(trigger.right - width, window.innerWidth - width - 12))}px`,
      top: upwards ? "auto" : `${Math.max(12, trigger.bottom + 6)}px`,
      bottom: upwards ? `${height - trigger.top + 6}px` : "auto",
    });
  };
  useEffect(() => {
    const outside = (e) => {
      if (ref.current && !ref.current.contains(e.target))
        ref.current.open = false;
    };
    const escape = (e) => {
      if (e.key === "Escape" && ref.current?.open) {
        e.preventDefault();
        e.stopPropagation();
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    ref.current?.addEventListener("keydown", escape);
    const element = ref.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      element?.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details
      ref={ref}
      aria-busy={busy}
      className={"action-menu " + className}
      onToggle={(e) => {
        if (e.target !== e.currentTarget) return;
        const p = panel.current;
        if (p?.showPopover) {
          if (e.currentTarget.open) {
            p.showPopover();
            place();
          } else p.hidePopover();
        } else e.currentTarget.dataset.inline = "true";
      }}
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
          e.currentTarget.open = false;
      }}
    >
      <summary>
        {busy ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <MoreHorizontal size={17} />
        )}{" "}
        {label}
        <ChevronDown size={13} />
      </summary>
      <div
        ref={panel}
        popover="manual"
        className="action-menu-panel"
        onClickCapture={(e) => {
          const action = e.target.closest("button,a[href]");
          if (action && !action.disabled) {
            ref.current.open = false;
            ref.current
              .querySelector("summary")
              ?.focus({ preventScroll: true });
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
