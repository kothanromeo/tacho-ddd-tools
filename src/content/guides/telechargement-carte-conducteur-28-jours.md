---
title: "Télécharger la carte conducteur tous les 28 jours : obligations et bonnes pratiques"
seoTitle: "Téléchargement carte conducteur : 28 jours, 90 jours, 1 an de conservation"
description: "Carte conducteur tous les 28 jours, véhicule tous les 90 jours, conservation 12 mois, 56 jours à présenter au contrôle : les obligations de téléchargement."
keywords: ["téléchargement carte conducteur", "télécharger carte chauffeur 28 jours", "téléchargement chronotachygraphe 90 jours", "conservation données tachygraphe", "fichier ddd", "obligation téléchargement tachygraphe", "56 jours contrôle routier", "clé de téléchargement tachygraphe", "lecteur carte conducteur", "archivage données conducteur"]
published: 2026-11-11
faq:
  - q: "Les 28 jours sont-ils des jours calendaires ?"
    a: "<p>Le règlement européen précise que seuls les jours où une activité est enregistrée sont comptés. En pratique, la plupart des entreprises téléchargent plus souvent (toutes les semaines ou tous les 15 jours), ce qui évite tout risque de perte.</p>"
  - q: "Le conducteur peut-il obtenir une copie de ses données ?"
    a: "<p>Oui. Le règlement prévoit que le conducteur peut demander à l’entreprise une copie des données de sa carte qui ont été téléchargées.</p>"
  - q: "Que faire si la carte est perdue ou abîmée ?"
    a: "<p>Le conducteur fait des impressions au début et à la fin du trajet et y note ses activités. Il doit demander une carte de remplacement dans les 7 jours, et peut conduire sans carte 15 jours au plus.</p>"
---

Une carte conducteur ne garde qu’une partie de son histoire : environ 28 jours d’activité pour une carte de première génération, un peu plus pour les cartes récentes. Au-delà, les nouvelles journées écrasent les plus anciennes. D’où l’obligation de **télécharger** régulièrement la carte et le chronotachygraphe, et de conserver les fichiers.

## Les délais

| Données | Délai maximal entre deux téléchargements |
|---|---|
| Carte conducteur | **28 jours** |
| Unité embarquée (le chronotachygraphe du véhicule) | **90 jours** |

Ces délais viennent du règlement (UE) 581/2010. Ils sont maximaux : l’entreprise doit télécharger aussi souvent que nécessaire pour qu’**aucune donnée ne soit perdue**. Un arrêté français de 2005 mentionne 95 jours pour l’unité embarquée, mais c’est le délai européen de 90 jours qui s’applique.

## La conservation

L’entreprise conserve les données téléchargées **au moins 12 mois**, et doit pouvoir les présenter aux contrôleurs, dans ses locaux ou à distance. Ne pas conserver les données est une contravention de 5<sup>e</sup> classe.

## Ce que le conducteur présente lors d’un contrôle routier

Depuis le **31 décembre 2024**, le conducteur doit pouvoir présenter sa carte et toutes les impressions et saisies manuelles de **la journée en cours et des 56 jours précédents** (28 jours auparavant). Ne pas pouvoir les présenter est également une contravention de 5<sup>e</sup> classe.

## Comment se fait le téléchargement

Le résultat est toujours un fichier, le plus souvent avec l’extension **.DDD** (parfois .C1B, .TGD, .ESM selon les logiciels). Il contient les données de la carte, signées numériquement pour prouver qu’elles n’ont pas été modifiées.

Trois façons de l’obtenir :

1. **Un lecteur de carte** branché sur un ordinateur, avec le logiciel fourni ;
2. **Une clé de téléchargement** branchée sur le chronotachygraphe du camion, qui récupère la carte insérée et la mémoire du véhicule ;
3. **Le téléchargement à distance**, via le boîtier télématique du véhicule, de plus en plus courant dans les flottes.

Le nom du fichier suit souvent une convention : lettre C pour une carte, date et heure, nom du conducteur ou numéro de carte.

## Lire le fichier

Un fichier DDD est binaire : il ne s’ouvre ni dans un tableur ni dans un éditeur de texte. Le [lecteur de fichiers DDD](/) l’affiche sans rien installer : identité de la carte, activités jour par jour, véhicules utilisés, temps de conduite et infractions probables. Le fichier est lu dans votre navigateur et n’est envoyé nulle part.

Pour comprendre ce que contient le fichier, voir [le fichier DDD de la carte conducteur](/guides/lire-fichier-ddd-carte-conducteur/).
