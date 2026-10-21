import { useState } from "react";
import { Modal, Button } from "./ui.jsx";
const steps = [
  [
    "Retrouver un animal",
    "Recherchez un nom dans les animaux. Sa fiche réunit les portraits locaux, la photo du site SPA et les outils de création.",
    "animals",
  ],
  [
    "Suivre la vie du refuge",
    "Le fil rassemble les arrivées, adoptions et changements. Les agents peuvent vérifier les départs depuis les adoptions à confirmer.",
    "feed",
  ],
  [
    "Préparer sa venue",
    "Dans Présences & missions, indiquez vos disponibilités et rejoignez un créneau de nettoyage, promenade ou collecte.",
    "volunteers",
  ],
  [
    "Créer et partager",
    "Les fiches de box et les affiches utilisent vos photos publiques ou celles du site SPA. Le studio vidéo et la gazette sont disponibles selon les modules du refuge.",
    "posters",
  ],
  [
    "Gérer son compte",
    "Choisissez les notifications utiles et retirez les anciens appareils depuis Compte & appareils.",
    "accountHub",
  ],
];
export function QuickTour({ go, user }) {
  const [step, setStep] = useState(null);
  return (
    <>
      <Button variant="ghost" onClick={() => setStep(0)}>
        Découvrir AniPic · 1 minute
      </Button>
      {step !== null && (
        <Modal
          title={"Bienvenue dans AniPic · " + (step + 1) + " / " + steps.length}
          onClose={() => setStep(null)}
        >
          <div className="quick-tour">
            <span className="tour-number">0{step + 1}</span>
            <h2>{steps[step][0]}</h2>
            <p>{steps[step][1]}</p>
            <div className="tour-progress">
              {steps.map((_, i) => (
                <i className={i === step ? "active" : ""} key={i} />
              ))}
            </div>
            <div className="form-row">
              <Button
                variant="secondary"
                onClick={() => {
                  go(steps[step][2]);
                  setStep(null);
                }}
              >
                Voir cette fonction
              </Button>
              <Button
                onClick={() =>
                  setStep(step === steps.length - 1 ? null : step + 1)
                }
              >
                {step === steps.length - 1 ? "C’est parti" : "Suivant"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
