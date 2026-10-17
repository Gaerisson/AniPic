export function NavLink({ href, onClick, children, ...props }) {
  return (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        if (
          e.button === 0 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          onClick?.(e);
        }
      }}
    >
      {children}
    </a>
  );
}
