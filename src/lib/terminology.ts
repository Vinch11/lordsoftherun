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
  },
};

export function getTerminology(term: Terminology | null | undefined): TerminologyLabels {
  return LABELS[term ?? "enseignant"];
}
