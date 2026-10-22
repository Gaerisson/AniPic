import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowLeft,
  X,
  PawPrint,
  Search,
  Rss,
  Images,
  CalendarDays,
  Settings,
} from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
const key = "anipic-tour-314";
export function QuickTour({ go, user, appMode, open, close }) {
  const steps = [
    {
      title: "Vos repères au refuge",
      text: "Retrouvez un animal, comprenez sa fiche et suivez les nouvelles de l’équipe. Vous pouvez essayer les fonctions pendant cette visite, ou la quitter à tout moment.",
      Icon: PawPrint,
    },
    {
      title: "Retrouver le bon animal",
      text: "Cherchez un prénom. Les filtres permettent de choisir chiens, chats, NAC, SOS et ententes. Les photos du site SPA restent disponibles lorsqu’aucun portrait de l’équipe n’a encore été ajouté.",
      page: "animals",
      selector: ".library-toolbar,.search-input,.page-heading",
      Icon: Search,
    },
    {
      title: "La fiche : son point de repère",
      text: "Ouvrez un exemple ci-dessous. La fiche réunit description, âge, statut et ententes : vert pour Oui, rouge pour Non, orange lorsqu’une condition ou une précision demande une lecture. Le texte complet reste disponible.",
      page: "animals",
      selector: ".animal-detail .detail-info",
      action: "animal",
      Icon: PawPrint,
    },
    {
      title: "Ses portraits, en détail",
      text: "Dans la fiche, sélectionnez une photo, zoomez puis glissez pour vous déplacer. Les flèches changent de portrait. L’origine SPA est indiquée ; les photos privées restent réservées aux comptes autorisés.",
      selector: ".animal-detail .detail-gallery",
      action: "animal",
      Icon: Images,
    },
    {
      title: "Au fil du refuge",
      text: "Les arrivées, départs et nouveaux portraits apparaissent dans l’ordre des événements. Les agents peuvent confirmer ou corriger une adoption sans remonter une ancienne nouvelle en tête du fil.",
      page: "feed",
      Icon: Rss,
    },
    ...(user
      ? [
          {
            title: "Une place pour chacun",
            text: "Consultez les missions et les bénévoles présents chaque jour. Inscrivez-vous sur un créneau ou indiquez vos disponibilités. L’agenda rassemble les dates importantes.",
            page: "volunteers",
            Icon: CalendarDays,
          },
        ]
      : []),
    {
      title: appMode
        ? "Votre refuge, dans votre poche"
        : "Les outils utiles, au même endroit",
      text: appMode
        ? "Personnalisez les boutons du bas et votre accueil. Dans Mon compte & appareils, choisissez vos notifications et gérez vos connexions."
        : "L’atelier de l’équipe regroupe notamment les prénoms, la météo et les priorités photo. Les réglages et l’administration disposent de leurs propres onglets.",
      page: appMode ? "appOptions" : "tools",
      Icon: Settings,
    },
  ];
  const [step, setStep] = useState(null),
    card = useRef(null),
    [target, setTarget] = useState(null),
    [trying, setTrying] = useState(false),
    [exampleError, setExampleError] = useState("");
  const openedExample = useRef(false);
  const tryAnimal = async () => {
    setTrying(true);
    setExampleError("");
    try {
      const result = await api("/animals?limit=1&sort=name");
      if (!result.items.length)
        throw Error("Aucun animal disponible pour cet exemple.");
      open?.({ type: "animal", id: result.items[0].id });
      openedExample.current = true;
    } catch (e) {
      setExampleError(e.message);
    } finally {
      setTrying(false);
    }
  };
  const finish = () => {
    try {
      localStorage.setItem(key, "done");
    } catch {}
    if (openedExample.current) {
      close?.();
      openedExample.current = false;
    }
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
    if (item.page && !item.action && openedExample.current) {
      close?.();
      openedExample.current = false;
    }
    if (item.page) go(item.page);
    const timer = setTimeout(() => {
      card.current?.focus({ preventScroll: true });
      const el =
        (item.selector && document.querySelector(item.selector)) ||
        document.querySelector(
          `.sidebar a[href="#${item.page}"],.app-bottom-nav a[href="#${item.page}"]`,
        ) ||
        document.querySelector(".page-heading");
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
            {item.action && (
              <Button loading={trying} variant="secondary" onClick={tryAnimal}>
                Ouvrir une fiche pour essayer
              </Button>
            )}
            {exampleError && <p role="status">{exampleError}</p>}
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
