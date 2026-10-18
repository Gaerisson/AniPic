import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Images, X, LoaderCircle } from "lucide-react";

export function Spinner() {
  return (
    <div className="loading">
      <span className="spa-loader">
        <img src="/anipic-icon.svg" alt="Anipic" />
        <i />
        <i />
        <i />
      </span>
      <span>Un petit instant…</span>
    </div>
  );
}
export function Empty({
  icon: Icon = Images,
  title = "Tout reste à écrire.",
  text = "Ajoutez vos premiers animaux et leurs photos pour donner vie à la photothèque.",
  action,
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Button({
  children,
  icon: Icon,
  variant = "",
  className = "",
  onClick,
  onDoubleClick,
  ...props
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
    >
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
  headerActions,
}) {
  const ref = useRef();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const elements = [
          ...ref.current.querySelectorAll(
            'button,a[href],input,select,textarea,summary,[tabindex="0"]',
          ),
        ].filter((el) => !el.disabled && el.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          {headerActions && (
            <div className="modal-header-actions">{headerActions}</div>
          )}
          <button className="icon-button" aria-label="Fermer" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
