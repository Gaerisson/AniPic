import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowLeft,
  X,
  PawPrint,
  Search,
  Rss,
  Printer,
  Settings,
} from "lucide-react";
import { Button } from "./ui.jsx";
const key = "anipic-tour-313";
export function QuickTour({ go, user, appMode }) {
  const steps = [
    {
      title: "Bienvenue au refuge",
      text: "En quelques étapes, découvrez où retrouver les animaux, suivre leurs nouvelles et créer vos premiers visuels.",
      Icon: PawPrint,
    },
    {
      title: "Un animal, toutes ses photos",
      text: "Cherchez son nom dans cette liste. Ouvrez sa fiche pour voir ses portraits, ses ententes et créer une affiche ou une vidéo.",
      page: "animals",
      Icon: Search,
    },
    {
      title: "Les nouvelles, dans un seul fil",
      text: "Arrivées, adoptions et nouveaux portraits se suivent ici. Une confirmation d’adoption met à jour son événement sans changer sa date.",
      page: "feed",
      Icon: Rss,
    },
    {
      title: "Votre première affiche",
      text: "Choisissez les animaux, puis une photo locale ou une photo du site SPA. Prévisualisez votre création avant de la télécharger.",
      page: "posters",
      Icon: Printer,
    },
    {
      title: appMode
        ? "Une application à votre image"
        : "Vos repères, toujours accessibles",
      text: appMode
        ? "Personnalisez ici les boutons du bas et les widgets de votre accueil. Dans Compte & appareils, choisissez vos notifications."
        : "La barre latérale regroupe les photos, les créations et l’équipe. Ses sections restent dans l’état où vous les laissez. Vous pouvez aussi personnaliser l’accueil Android.",
      page: "appOptions",
      Icon: Settings,
    },
  ];
  const [step, setStep] = useState(null),
    card = useRef(null),
    [target, setTarget] = useState(null);
  const finish = () => {
    try {
      localStorage.setItem(key, "done");
    } catch {}
    setStep(null);
  };
  const start = () => {
    try {
      localStorage.setItem(key, "started");
    } catch {}
    setStep(0);
  };
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(key);
    } catch {}
    if (seen) return;
    let launched = false;
    const launch = () => {
      if (launched) return;
      try {
        if (localStorage.getItem(key)) {
          launched = true;
          clearInterval(timer);
          return;
        }
      } catch {}
      const blocked = [
        ...document.querySelectorAll('[role="dialog"],.modal-backdrop'),
      ].some(
        (e) =>
          e.getClientRects().length &&
          getComputedStyle(e).visibility !== "hidden",
      );
      if (blocked) return;
      launched = true;
      start();
      clearInterval(timer);
    };
    const timer = setInterval(launch, 1500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (step === null) {
      setTarget(null);
      return;
    }
    const item = steps[step];
    if (item.page) go(item.page);
    const timer = setTimeout(() => {
      card.current?.focus({ preventScroll: true });
      const el =
        document.querySelector(
          `.sidebar a[href="#${item.page}"],.app-bottom-nav a[href="#${item.page}"]`,
        ) || document.querySelector(".page-heading");
      if (el) {
        el.classList.add("tour-highlight");
        setTarget(el);
      }
    }, 150);
    const escape = (e) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", escape);
    return () => {
      clearTimeout(timer);
      document
        .querySelectorAll(".tour-highlight")
        .forEach((e) => e.classList.remove("tour-highlight"));
      window.removeEventListener("keydown", escape);
    };
  }, [step]);
  const item = steps[step],
    Icon = item?.Icon;
  return (
    <>
      <Button variant="ghost" onClick={start}>
        Découvrir AniPic · 1 minute
      </Button>
      {item &&
        createPortal(
          <div
            className="tour-coach"
            role="dialog"
            aria-label="Découvrir AniPic"
            aria-modal="false"
            tabIndex={-1}
            ref={card}
          >
            <header>
              <span>
                PREMIERS PAS · {step + 1}/{steps.length}
              </span>
              <button aria-label="Passer le didacticiel" onClick={finish}>
                <X size={18} />
              </button>
            </header>
            <div className="tour-icon">
              <Icon size={24} />
            </div>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <div className="tour-progress">
              {steps.map((s, i) => (
                <i key={i} className={i <= step ? "active" : ""} />
              ))}
            </div>
            <footer>
              <button className="text-link" onClick={finish}>
                Passer
              </button>
              <div>
                {step > 0 && (
                  <Button
                    variant="ghost"
                    aria-label="Étape précédente"
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft size={17} />
                  </Button>
                )}
                <Button
                  onClick={() =>
                    step === steps.length - 1 ? finish() : setStep(step + 1)
                  }
                >
                  {step === steps.length - 1 ? "À vous de jouer" : "Suivant"}
                  <ArrowRight size={17} />
                </Button>
              </div>
            </footer>
          </div>,
          document.body,
        )}
    </>
  );
}
