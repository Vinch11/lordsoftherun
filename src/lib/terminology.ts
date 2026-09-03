export type Terminology = "enseignant" | "organisateur";

export type TerminologyLabels = {
  term: Terminology;
  roleNoun: string;
  roleNounCap: string;
  badge: string;
  spaceTitle: string;
  accountNoun: string;
  createGameButton: string;
  dashboardTitle: string;
  ownerOnlyError: string;
  readOnlyNotice: string;
  pendingApproval: string;

  // Participants (élèves / participants)
  participantNoun: string;
  participantNounPlural: string;
  participantNounCap: string;
  participantNounCapPlural: string;

  // Roster import / CSV
  joinPanelTitle: string;
  rosterEmptyHelp: string;
  rosterImportButton: string;
  noParticipantsFoundError: string;
  addParticipantPlaceholder: string;
  addParticipantAria: string;
  rosterComposedToast: (present: number, teamCount: number) => string;
  exportCsvButton: string;
  csvDistanceHeader: string;
  csvSpeedHeader: string;

  // Async ("chacun chez soi") mode
  challengeModeHelp: string;
  asyncModeExplainer: string;
  loopCloseAutoHelp: string;
  loopCloseManualHelp: string;
  participantIdSectionTitle: string;
  studentIdRosterHelp: string;
  studentIdFreetextHelp: string;
  studentIdNoneHelp: string;

  // Screen theme + preview
  participantScreenThemeTitle: string;
  participantPreviewSectionTitle: string;
  participantPreviewIframeTitle: string;

  // Roster wizard
  rosterWizardGroupButtonLabel: string;
  rosterWizardGroupsDetectedHelp: (groupCount: number, unassignedCount: number) => string;
  rosterWizardUnassignedHelp: (n: number) => string;
};

const LABELS: Record<Terminology, TerminologyLabels> = {
  enseignant: {
    term: "enseignant",
    roleNoun: "enseignant",
    roleNounCap: "Enseignant",
    badge: "Enseignant",
    spaceTitle: "Espace enseignant",
    accountNoun: "compte enseignant",
    createGameButton: "+ Créer une partie (enseignant)",
    dashboardTitle: "Tableau de bord enseignant",
    ownerOnlyError: "Seul l'enseignant propriétaire peut piloter cette partie.",
    readOnlyNotice: "seul l'enseignant qui l'a créée peut la",
    pendingApproval: "Compte enseignant en attente de validation par l'administrateur.",

    participantNoun: "élève",
    participantNounPlural: "élèves",
    participantNounCap: "Élève",
    participantNounCapPlural: "Élèves",

    joinPanelTitle: "Groupe d'élèves",
    rosterEmptyHelp:
      "Importez la liste de classe (export CSV iDoceo) pour prendre la présence et répartir les équipes automatiquement.",
    rosterImportButton: "Importer un CSV iDoceo",
    noParticipantsFoundError: "Aucun élève trouvé dans ce fichier.",
    addParticipantPlaceholder: "Ajouter un élève",
    addParticipantAria: "Ajouter l'élève",
    rosterComposedToast: (present, teamCount) =>
      `${present} élèves répartis en ${teamCount} équipes.`,
    exportCsvButton: "Exporter CSV (iDoceo)",
    csvDistanceHeader: "Distance élève (km)",
    csvSpeedHeader: "Vitesse élève (km/h)",

    challengeModeHelp:
      "Mode Challenge : idéal pour un défi inter-classes sur plusieurs jours. Pensez à ne pas définir de zone de retour (ci-dessous) pour ne pas bloquer les retardataires.",
    asyncModeExplainer:
      "Pour une conquête qui s'étale sur plusieurs jours ou semaines (ex. une promenade du chien chaque soir) : chaque élève lance une boucle quand il le peut, plutôt que de garder l'appli ouverte en continu. Les équipes doivent être créées à l'avance (import CSV avec une équipe par classe, ou créées à la main ci-dessous) et plusieurs élèves d'une même équipe peuvent jouer en même temps depuis leur propre téléphone.",
    loopCloseAutoHelp:
      "La boucle se ferme toute seule dès que l'élève repasse près de son point de départ.",
    loopCloseManualHelp:
      "L'élève doit confirmer lui-même la fin de sa boucle, une fois revenu près du départ.",
    participantIdSectionTitle: "Identification de l'élève",
    studentIdRosterHelp:
      "L'élève choisit son prénom dans la liste importée par CSV — nécessaire pour les stats individuelles, mais demande d'avoir importé la classe à l'avance.",
    studentIdFreetextHelp:
      "L'élève tape lui-même son prénom en rejoignant l'équipe — fonctionne même sans import CSV, et donne quand même des stats individuelles.",
    studentIdNoneHelp:
      "L'élève rejoint directement son équipe sans dire qui il est — le plus rapide, mais pas de stats par élève.",

    participantScreenThemeTitle: "Thème de l'écran élève",
    participantPreviewSectionTitle: "Aperçu élève",
    participantPreviewIframeTitle: "Aperçu grandeur nature du thème élève",

    rosterWizardGroupButtonLabel: "Par classe",
    rosterWizardGroupsDetectedHelp: (groupCount, unassignedCount) =>
      `${groupCount} classe${groupCount > 1 ? "s" : ""} détectée${groupCount > 1 ? "s" : ""} dans le fichier importé — une équipe par classe.` +
      (unassignedCount > 0
        ? ` ${unassignedCount} élève${unassignedCount > 1 ? "s" : ""} sans classe à placer à la main ci-dessous.`
        : ""),
    rosterWizardUnassignedHelp: (n) => `Élèves à placer (${n}) — touchez un nom puis une équipe.`,
  },
  organisateur: {
    term: "organisateur",
    roleNoun: "organisateur",
    roleNounCap: "Organisateur",
    badge: "Organisateur",
    spaceTitle: "Espace organisateur",
    accountNoun: "compte organisateur",
    createGameButton: "+ Créer une partie (organisateur)",
    dashboardTitle: "Tableau de bord organisateur",
    ownerOnlyError: "Seul l'organisateur propriétaire peut piloter cette partie.",
    readOnlyNotice: "seul l'organisateur qui l'a créée peut la",
    pendingApproval: "Compte organisateur en attente de validation par l'administrateur.",

    participantNoun: "participant",
    participantNounPlural: "participants",
    participantNounCap: "Participant",
    participantNounCapPlural: "Participants",

    joinPanelTitle: "Groupe de participants",
    rosterEmptyHelp:
      "Importez la liste des participants (fichier CSV) pour prendre la présence et répartir les équipes automatiquement.",
    rosterImportButton: "Importer une liste (CSV)",
    noParticipantsFoundError: "Aucun participant trouvé dans ce fichier.",
    addParticipantPlaceholder: "Ajouter un participant",
    addParticipantAria: "Ajouter le participant",
    rosterComposedToast: (present, teamCount) =>
      `${present} participants répartis en ${teamCount} équipes.`,
    exportCsvButton: "Exporter CSV",
    csvDistanceHeader: "Distance participant (km)",
    csvSpeedHeader: "Vitesse participant (km/h)",

    challengeModeHelp:
      "Mode Challenge : idéal pour un défi entre groupes sur plusieurs jours. Pensez à ne pas définir de zone de retour (ci-dessous) pour ne pas bloquer les retardataires.",
    asyncModeExplainer:
      "Pour une conquête qui s'étale sur plusieurs jours ou semaines (ex. une promenade du chien chaque soir) : chaque participant lance une boucle quand il le peut, plutôt que de garder l'appli ouverte en continu. Les équipes doivent être créées à l'avance (import CSV avec une équipe par groupe, ou créées à la main ci-dessous) et plusieurs participants d'une même équipe peuvent jouer en même temps depuis leur propre téléphone.",
    loopCloseAutoHelp:
      "La boucle se ferme toute seule dès que le participant repasse près de son point de départ.",
    loopCloseManualHelp:
      "Le participant doit confirmer lui-même la fin de sa boucle, une fois revenu près du départ.",
    participantIdSectionTitle: "Identification du participant",
    studentIdRosterHelp:
      "Le participant choisit son prénom dans la liste importée par CSV — nécessaire pour les stats individuelles, mais demande d'avoir importé la liste à l'avance.",
    studentIdFreetextHelp:
      "Le participant tape lui-même son prénom en rejoignant l'équipe — fonctionne même sans import CSV, et donne quand même des stats individuelles.",
    studentIdNoneHelp:
      "Le participant rejoint directement son équipe sans dire qui il est — le plus rapide, mais pas de stats individuelles.",

    participantScreenThemeTitle: "Thème de l'écran participant",
    participantPreviewSectionTitle: "Aperçu participant",
    participantPreviewIframeTitle: "Aperçu grandeur nature du thème participant",

    rosterWizardGroupButtonLabel: "Par groupe",
    rosterWizardGroupsDetectedHelp: (groupCount, unassignedCount) =>
      `${groupCount} groupe${groupCount > 1 ? "s" : ""} détecté${groupCount > 1 ? "s" : ""} dans le fichier importé — une équipe par groupe.` +
      (unassignedCount > 0
        ? ` ${unassignedCount} participant${unassignedCount > 1 ? "s" : ""} sans groupe à placer à la main ci-dessous.`
        : ""),
    rosterWizardUnassignedHelp: (n) =>
      `Participant${n > 1 ? "s" : ""} à placer (${n}) — touchez un nom puis une équipe.`,
  },
};

export function getTerminology(term: Terminology | null | undefined): TerminologyLabels {
  return LABELS[term ?? "enseignant"];
}
