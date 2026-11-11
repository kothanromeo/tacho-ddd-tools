/* Tables de codes du chronotachygraphe (annexe 1B, annexe 1C appendice 1, liste JRC des codes pays). */

/** NationNumeric → [nom, signe distinctif]. */
export const NATIONS: Record<number, [string, string]> = {
  0x01: ['Autriche', 'A'], 0x02: ['Albanie', 'AL'], 0x03: ['Andorre', 'AND'], 0x04: ['Arménie', 'ARM'], 0x05: ['Azerbaïdjan', 'AZ'],
  0x06: ['Belgique', 'B'], 0x07: ['Bulgarie', 'BG'], 0x08: ['Bosnie-Herzégovine', 'BIH'], 0x09: ['Biélorussie', 'BY'], 0x0a: ['Suisse', 'CH'],
  0x0b: ['Chypre', 'CY'], 0x0c: ['Tchéquie', 'CZ'], 0x0d: ['Allemagne', 'D'], 0x0e: ['Danemark', 'DK'], 0x0f: ['Espagne', 'E'],
  0x10: ['Estonie', 'EST'], 0x11: ['France', 'F'], 0x12: ['Finlande', 'FIN'], 0x13: ['Liechtenstein', 'FL'], 0x14: ['Îles Féroé', 'FR'],
  0x15: ['Royaume-Uni', 'UK'], 0x16: ['Géorgie', 'GE'], 0x17: ['Grèce', 'GR'], 0x18: ['Hongrie', 'H'], 0x19: ['Croatie', 'HR'],
  0x1a: ['Italie', 'I'], 0x1b: ['Irlande', 'IRL'], 0x1c: ['Islande', 'IS'], 0x1d: ['Kazakhstan', 'KZ'], 0x1e: ['Luxembourg', 'L'],
  0x1f: ['Lituanie', 'LT'], 0x20: ['Lettonie', 'LV'], 0x21: ['Malte', 'M'], 0x22: ['Monaco', 'MC'], 0x23: ['Moldavie', 'MD'],
  0x24: ['Macédoine du Nord', 'MK'], 0x25: ['Norvège', 'N'], 0x26: ['Pays-Bas', 'NL'], 0x27: ['Portugal', 'P'], 0x28: ['Pologne', 'PL'],
  0x29: ['Roumanie', 'RO'], 0x2a: ['Saint-Marin', 'RSM'], 0x2b: ['Russie', 'RUS'], 0x2c: ['Suède', 'S'], 0x2d: ['Slovaquie', 'SK'],
  0x2e: ['Slovénie', 'SLO'], 0x2f: ['Turkménistan', 'TM'], 0x30: ['Turquie', 'TR'], 0x31: ['Ukraine', 'UA'], 0x32: ['Vatican', 'V'],
  0x33: ['Yougoslavie', 'YU'], 0x34: ['Monténégro', 'MNE'], 0x35: ['Serbie', 'SRB'], 0x36: ['Ouzbékistan', 'UZ'], 0x37: ['Tadjikistan', 'TJ'],
  0x38: ['Kirghizistan', 'KG'], 0x39: ['Israël', 'IL'], 0xfd: ['Communauté européenne', 'EC'], 0xfe: ['Reste de l’Europe', 'EUR'], 0xff: ['Reste du monde', 'WLD'],
};

export const nationName = (code: number) => NATIONS[code]?.[0] ?? (code ? `pays ${code.toString(16).toUpperCase().padStart(2, '0')}` : '');
export const nationSign = (code: number) => NATIONS[code]?.[1] ?? '';

/** EventFaultType → libellé. */
export const EVENT_TYPES: Record<number, string> = {
  0x00: 'Événement sans précision',
  0x01: 'Insertion d’une carte non valable',
  0x02: 'Conflit de cartes',
  0x03: 'Chevauchement temporel',
  0x04: 'Conduite sans carte appropriée',
  0x05: 'Insertion de la carte pendant la conduite',
  0x06: 'Dernière session de la carte mal clôturée',
  0x07: 'Excès de vitesse',
  0x08: 'Interruption de l’alimentation électrique',
  0x09: 'Erreur sur les données de mouvement',
  0x0a: 'Conflit concernant le mouvement du véhicule',
  0x0b: 'Conflit d’heure (GNSS et horloge de l’appareil)',
  0x0c: 'Erreur de communication à distance',
  0x0d: 'Absence de position GNSS',
  0x0e: 'Erreur de communication avec le GNSS externe',
  0x0f: 'Anomalie GNSS',
  0x10: 'Atteinte à la sécurité de l’unité embarquée',
  0x11: 'Échec d’authentification du capteur de mouvement',
  0x12: 'Échec d’authentification de la carte',
  0x13: 'Remplacement non autorisé du capteur de mouvement',
  0x14: 'Erreur d’intégrité des données de la carte',
  0x15: 'Erreur d’intégrité des données enregistrées',
  0x16: 'Erreur de transfert interne des données',
  0x17: 'Ouverture non autorisée du boîtier',
  0x18: 'Sabotage du matériel',
  0x19: 'Détection de manipulation du GNSS',
  0x1a: 'Échec d’authentification du GNSS externe',
  0x1b: 'Certificat du GNSS externe expiré',
  0x1c: 'Incohérence entre mouvement du véhicule et activités enregistrées',
  0x20: 'Atteinte à la sécurité du capteur',
  0x21: 'Échec d’authentification (capteur)',
  0x22: 'Erreur d’intégrité des données (capteur)',
  0x23: 'Erreur de transfert interne (capteur)',
  0x24: 'Ouverture non autorisée du boîtier (capteur)',
  0x25: 'Sabotage du matériel (capteur)',
  0x30: 'Défaut de l’appareil de contrôle',
  0x31: 'Défaut interne de l’unité embarquée',
  0x32: 'Défaut de l’imprimante',
  0x33: 'Défaut de l’affichage',
  0x34: 'Défaut de téléchargement',
  0x35: 'Défaut du capteur',
  0x36: 'Défaut du récepteur GNSS interne',
  0x37: 'Défaut du dispositif GNSS externe',
  0x38: 'Défaut du dispositif de communication à distance',
  0x39: 'Défaut de l’interface ITS',
  0x3a: 'Défaut du capteur interne',
  0x40: 'Défaut de la carte',
};

export const eventLabel = (t: number) =>
  EVENT_TYPES[t] ?? (t >= 0x80 ? `Code propre au fabricant (${t.toString(16).toUpperCase()})` : `Code ${t.toString(16).toUpperCase().padStart(2, '0')}`);

/** Événements qui méritent l'attention d'un contrôleur ou d'un exploitant. */
export const SERIOUS_EVENTS = new Set([0x04, 0x05, 0x07, 0x0a, 0x10, 0x13, 0x17, 0x18, 0x19, 0x1c]);

export const ENTRY_TYPES: Record<number, string> = {
  0: 'Début (insertion de la carte)',
  1: 'Fin (retrait de la carte)',
  2: 'Début (saisie manuelle)',
  3: 'Fin (saisie manuelle)',
  4: 'Début (supposé par l’appareil)',
  5: 'Fin (supposée par l’appareil)',
  6: 'Début (position GNSS)',
  7: 'Fin (position GNSS)',
};
export const isBegin = (entryType: number) => entryType % 2 === 0;

export const SPECIFIC_CONDITIONS: Record<number, string> = {
  1: 'Hors champ : début',
  2: 'Hors champ : fin',
  3: 'Ferry ou train',
  4: 'Ferry ou train : fin',
};

export function controlLabel(t: number): string {
  const parts: string[] = [];
  if (t & 0x80) parts.push('carte téléchargée');
  if (t & 0x40) parts.push('appareil téléchargé');
  if (t & 0x20) parts.push('impression');
  if (t & 0x10) parts.push('affichage consulté');
  if (t & 0x08) parts.push('contrôle d’étalonnage');
  return parts.join(', ') || 'contrôle';
}

export const ACTIVITY_LABELS = { rest: 'Repos', available: 'Disponibilité', work: 'Travail', driving: 'Conduite', unknown: 'Inconnu (carte retirée)' } as const;
