import { useEffect, useState, useRef } from "react";
import { api } from "./api.js";
import { Button, Modal, Spinner } from "./ui.jsx";
export function usePrivacy() {
  const [data, setData] = useState(null);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const request = ++revision.current;
      api("/privacy")
        .then((d) => active && request === revision.current && setData(d))
        .catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("anipic-privacy-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("anipic-privacy-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return {
    data,
    refresh: () => api("/privacy").then(setData),
    choose: async (analytics) => {
      const r = await api("/privacy/consent", {
        method: "POST",
        body: { analytics, version: data.version },
      });
      // An older refresh must never replace a choice just saved by the user.
      revision.current++;
      setData((d) => ({ ...d, consent: r.consent }));
    },
    chooseAudience: async (optOut) => {
      await api("/audience/preference", { method: "POST", body: { optOut } });
      revision.current++;
      setData((d) => ({ ...d, audience: { ...d.audience, optedOut: optOut } }));
    },
  };
}
export function CookieChoices({ privacy, onClose }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!privacy.data) return null;
  const save = async (value) => {
    setBusy(true);
    try {
      await privacy.choose(value);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="privacy-banner" aria-label="Vos choix de confidentialité">
      <div>
        <strong>Votre vie privée</strong>
        <p>
          Les cookies de connexion, de sécurité et vos préférences permettent de
          faire fonctionner AniPic.{" "}
          {privacy.data.legal.analyticsEnabled
            ? "Le suivi détaillé est facultatif et désactivé sans votre accord."
            : "Aucun suivi détaillé de fréquentation n’est activé."}
        </p>
        <a href="#privacy">Lire la politique de confidentialité</a>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="privacy-actions">
        <Button variant="secondary" disabled={busy} onClick={() => save(false)}>
          Refuser le suivi détaillé
        </Button>
        {privacy.data.legal.analyticsEnabled && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => save(true)}
          >
            Accepter le suivi détaillé
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        )}
      </div>
      {privacy.data.audience?.enabled && (
        <div className="anonymous-choice">
          <p>
            Un compteur anonyme additionne les consultations par rubrique, sans
            cookie de suivi ni identification.
          </p>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await privacy.chooseAudience(!privacy.data.audience.optedOut);
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {privacy.data.audience.optedOut
              ? "Autoriser le comptage anonyme"
              : "Ne pas compter mes consultations"}
          </Button>
        </div>
      )}
    </aside>
  );
}
export function LegalPage({ kind = "privacy" }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    api("/privacy").then(setD);
  }, []);
  if (!d) return <Spinner />;
  const l = d.legal,
    contact = l.dpoEmail || l.contactEmail;
  const missing = (x) => x || "À compléter par l’exploitant";
  return (
    <article className="panel legal-document">
      <h1>
        {kind === "terms"
          ? "Conditions d’utilisation"
          : kind === "legal"
            ? "Mentions légales"
            : "Confidentialité et cookies"}
      </h1>
      <p>
        Version du {d.version}.{" "}
        {!d.complete &&
          "Les coordonnées de l’exploitant doivent encore être complétées dans l’administration."}
      </p>
      {kind === "legal" ? (
        <>
          <h2>Éditeur du service</h2>
          <p>
            {missing(l.operatorName)}
            <br />
            {missing(l.operatorAddress)}
            <br />
            Contact : {missing(l.contactEmail)}
            <br />
            Direction de publication : {missing(l.publicationDirector)}
          </p>
          <h2>Hébergement</h2>
          <p>
            {missing(l.hostName)}
            <br />
            {missing(l.hostAddress)}
            <br />
            {missing(l.hostContact)}
          </p>
          <h2>Logiciel et contenus</h2>
          <p>
            AniPic est développé par Gaerisson. © {new Date().getFullYear()}{" "}
            Gaerisson. Le logo et les contenus de la SPA restent la propriété de
            leurs titulaires. Les photographies restent soumises aux droits de
            leurs auteurs ; leur présence dans l’outil ne confère pas un droit
            de réutilisation libre.
          </p>
        </>
      ) : kind === "terms" ? (
        <>
          <h2>Objet et accès</h2>
          <p>
            AniPic accompagne l’équipe du refuge dans la gestion des portraits,
            de ses supports de communication, du planning et de l’affichage.
            L’accès aux fonctions internes dépend du compte et de ses
            habilitations. Le code PIN du refuge ne remplace pas un compte
            personnel.
          </p>
          <h2>Utilisation responsable</h2>
          <p>
            Gardez vos identifiants confidentiels. Ne publiez que des contenus
            dont vous détenez les autorisations nécessaires, notamment pour les
            personnes reconnaissables. Les informations internes concernant des
            personnes ne doivent être saisies que si elles sont nécessaires,
            exactes, licites et accessibles aux seules personnes habilitées.
            Aucun propos discriminatoire, diffamatoire ou donnée sensible
            injustifiée n’est autorisé.
          </p>
          <h2>Informations sur les animaux et publications</h2>
          <p>
            Les informations synchronisées et les départs automatiques peuvent
            nécessiter une vérification par le refuge. Les propositions de
            texte, avec ou sans IA, doivent être relues avant publication.
            AniPic ne publie pas automatiquement les corrections sur le site
            SPA.
          </p>
          <h2>Disponibilité et mises à jour</h2>
          <p>
            L’exploitant peut suspendre une fonction pour maintenance ou
            sécurité. Les mises à jour Android sont proposées à l’utilisateur ;
            Android demande sa confirmation pour installer l’APK. Les données du
            service sont conservées sur le serveur de l’exploitant.
          </p>
          <h2>Droits et contact</h2>
          <p>
            Ces conditions ne limitent pas les droits impératifs applicables.
            Pour toute question ou demande concernant vos données :{" "}
            {missing(contact)}.
          </p>
        </>
      ) : (
        <>
          <h2>Qui traite vos données ?</h2>
          <p>
            {missing(l.operatorName)}, {missing(l.operatorAddress)}, est
            responsable des traitements de cette instance. Contact :{" "}
            {missing(contact)}. L’auteur du logiciel n’a pas automatiquement
            accès aux données de votre serveur.
          </p>
          <h2>Pourquoi et sur quelle base ?</h2>
          <ul>
            <li>
              Comptes, habilitations, connexion et journaux de sécurité :
              protection du service et organisation du refuge, sur la base de
              l’intérêt légitime de l’exploitant. Les cookies strictement
              nécessaires ne demandent pas de consentement.
            </li>
            <li>
              Planning, disponibilités, participations et échanges internes :
              organisation de l’équipe, sur la base de cet intérêt légitime ;
              leur saisie est limitée aux besoins du refuge.
            </li>
            <li>
              Le suivi détaillé de fréquentation repose sur votre consentement,
              retirable à tout moment dans « Cookies ». Un compteur séparé
              additionne uniquement des totaux anonymes par jour et rubrique,
              pour mesurer l’utilisation du site pour le seul refuge.
            </li>
            <li>
              Notifications : uniquement après activation de vos catégories et
              autorisation du navigateur. Vous pouvez les arrêter dans votre
              compte ou les réglages Android.
            </li>
          </ul>
          <h2>Quelles données, pour combien de temps ?</h2>
          <p>
            Le compteur anonyme ne conserve ni IP, compte, identifiant de
            session, navigateur, recherche ou URL de partage. Il ne suit pas les
            parcours et ne mesure pas des visiteurs uniques. Les totaux restent
            sur ce serveur pendant 90 jours ; ils ne sont pas transmis à un
            prestataire. Le signal GPC et votre opposition sont respectés.
          </p>
          {d.audience?.enabled && <AudienceOpposition data={d} update={setD} />}
          <p>
            Le compte contient votre nom, rôle, fournisseur de connexion et
            avatar éventuel. La connexion mémorisée dure 90 jours et se
            renouvelle lors d’une utilisation active ; elle peut être révoquée.
            Le PIN reste mémorisé jusqu’à révocation côté serveur, avec un
            cookie renouvelable limité par le navigateur à 400 jours. Le choix
            des statistiques est conservé 180 jours. Les visites facultatives
            (IP, pays approximatif, page, navigateur, compte connecté) sont
            conservées {l.visitorRetentionDays} jours. Les journaux techniques
            de sécurité sont conservés au maximum {l.securityRetentionDays}{" "}
            jours, dans la limite de 10 000 accès.
          </p>
          <p>
            Les autres données de compte et de planning sont conservées pendant
            la participation au refuge, puis revues par l’exploitant à la fin de
            la relation. Celui-ci doit fixer et appliquer une durée adaptée, y
            compris aux sauvegardes, et documenter ses éventuelles obligations
            de conservation. Les originaux et archives du refuge ne sont pas
            effacés automatiquement avec une mise à jour.
          </p>
          <h2>Stockage local et destinataires</h2>
          <p>
            Le navigateur conserve votre thème, le menu et les préférences
            d’affichage. Le mode hors connexion ne conserve pas vos photos,
            vidéos ou réponses API. Les administrateurs habilités accèdent aux
            comptes et journaux ; le planning est réservé à l’équipe connectée.
            La géolocalisation IP est effectuée avec une base locale lorsqu’elle
            est configurée.
          </p>
          <p>
            Google reçoit les données nécessaires si vous choisissez sa
            connexion. Canva reçoit les médias que vous choisissez de lui
            envoyer. Le service IA configuré reçoit le texte et le contexte
            envoyés quand vous lancez sa génération. Les notifications
            transitent par le service de votre navigateur (Google, Mozilla,
            Apple ou Microsoft). Ces services peuvent traiter des données hors
            de l’EEE ; l’exploitant doit vérifier leurs contrats, destinations
            et garanties avant activation.{" "}
            {l.internationalTransfers ||
              "Les informations contractuelles et garanties des prestataires sont à préciser par l’exploitant."}
          </p>
          {l.aiPrivacyUrl && (
            <p>
              <a href={l.aiPrivacyUrl} rel="noreferrer" target="_blank">
                Politique du prestataire IA configuré
              </a>
            </p>
          )}
          <h2>Vos choix et vos droits</h2>
          <p>
            Vous pouvez demander l’accès, la rectification, l’effacement, la
            limitation, la portabilité lorsque applicable, ou vous opposer à un
            traitement fondé sur l’intérêt légitime, en écrivant à{" "}
            {missing(contact)}. Une réponse doit normalement être apportée dans
            le mois, sous réserve des prolongations prévues par le RGPD. Les
            comptes connectés peuvent exporter leurs informations depuis «
            Compte et appareils ». Vous pouvez également adresser une
            réclamation à la{" "}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noreferrer"
            >
              CNIL
            </a>
            .
          </p>
          <p>
            Les statistiques ne conditionnent pas l’accès au site. Aucun
            profilage publicitaire ni décision juridique automatisée sur les
            personnes n’est prévu.
          </p>
        </>
      )}
    </article>
  );
}
function AudienceOpposition({ data, update }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="anonymous-choice">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const optOut = !data.audience.optedOut;
            await api("/audience/preference", {
              method: "POST",
              body: { optOut },
            });
            update((d) => ({
              ...d,
              audience: { ...d.audience, optedOut: optOut },
            }));
            window.dispatchEvent(new Event("anipic-privacy-changed"));
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {data.audience.optedOut
          ? "Reprendre le comptage anonyme"
          : "Ne pas compter mes consultations"}
      </Button>
      <small>
        {data.audience.optedOut
          ? "Votre opposition est enregistrée dans un cookie de préférence sans identifiant."
          : "Vous pouvez vous opposer à ce comptage sans changer votre accès au site."}
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function LegalSettings({ notify }) {
  const [v, setV] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/legal").then((d) => setV(d.legal));
  }, []);
  if (!v) return <Spinner />;
  const labels = {
    operatorName: "Nom de la structure exploitante",
    operatorAddress: "Adresse de l’exploitant",
    contactEmail: "E-mail de contact",
    publicationDirector: "Responsable de publication",
    hostName: "Hébergeur",
    hostAddress: "Adresse de l’hébergeur",
    hostContact: "Contact de l’hébergeur",
    dpoEmail: "Contact données personnelles (facultatif)",
    aiPrivacyUrl: "Politique de confidentialité du service IA",
    internationalTransfers: "Prestataires, transferts et garanties",
  };
  return (
    <section className="panel legal-settings">
      <h1>Mentions et confidentialité</h1>
      <p>
        Renseignez les informations de cette instance et vérifiez les contrats
        des prestataires, les durées et les autorisations de publication. Ces
        pages sont une base de travail, pas une certification juridique.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/admin/legal", { method: "PUT", body: v });
            notify("Informations enregistrées.");
          } catch (e) {
            notify(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {Object.entries(labels).map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type={
                k.toLowerCase().includes("email")
                  ? "email"
                  : k === "aiPrivacyUrl"
                    ? "url"
                    : "text"
              }
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={v.analyticsEnabled}
            onChange={(e) => setV({ ...v, analyticsEnabled: e.target.checked })}
          />
          Proposer les statistiques facultatives avec consentement
        </label>
        {["visitorRetentionDays", "securityRetentionDays"].map((k) => (
          <label key={k}>
            {k === "visitorRetentionDays"
              ? "Conservation des visites (1–30 jours)"
              : "Journaux de sécurité (1–90 jours)"}
            <input
              type="number"
              min="1"
              max={k === "visitorRetentionDays" ? 30 : 90}
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
        <Button type="submit" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </section>
  );
}
