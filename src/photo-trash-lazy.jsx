import { lazy, Suspense } from "react";
const Content = lazy(() =>
  import("./photo-trash.jsx").then((m) => ({ default: m.PhotoTrash })),
);
export function PhotoTrash(props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="small-note">
          Chargement de la corbeille…
        </p>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
