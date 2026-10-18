import { useRef, useEffect } from "react";
import { MoreHorizontal, ChevronDown, LoaderCircle } from "lucide-react";
export function ActionMenu({
  label = "Actions",
  children,
  className = "",
  busy = false,
}) {
  const ref = useRef();
  useEffect(() => {
    const outside = (e) => {
      if (ref.current && !ref.current.contains(e.target))
        ref.current.open = false;
    };
    const escape = (e) => {
      if (e.key === "Escape" && ref.current?.open) {
        e.stopPropagation();
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    ref.current?.addEventListener("keydown", escape);
    const element = ref.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      element?.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details
      ref={ref}
      aria-busy={busy}
      className={"action-menu " + className}
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
