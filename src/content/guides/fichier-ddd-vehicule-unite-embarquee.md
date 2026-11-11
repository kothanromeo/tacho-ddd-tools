---
title: "Le fichier DDD du véhicule : ce que contient la mémoire du chronotachygraphe"
seoTitle: "Fichier DDD véhicule (unité embarquée) : contenu et lecture"
description: "Conducteurs, activités, excès de vitesse, vitesse détaillée, étalonnages, verrous : ce que contient le fichier DDD d’un véhicule et comment le lire."
keywords: ["fichier ddd véhicule", "téléchargement chronotachygraphe véhicule", "unité embarquée tachygraphe", "mémoire de masse chronotachygraphe", "fichier v1b", "téléchargement 90 jours", "verrou entreprise tachygraphe", "excès de vitesse chronotachygraphe", "vitesse détaillée tachygraphe", "étalonnage chronotachygraphe", "conduite sans carte", "lire fichier ddd camion"]
published: 2026-11-11
faq:
  - q: "Quelle différence avec le fichier de la carte conducteur ?"
    a: "<p>La carte suit un conducteur, quel que soit le véhicule. Le fichier du véhicule suit un camion, quels que soient les conducteurs : on y voit qui l’a conduit, quand, et ce qui s’est passé sans carte insérée.</p>"
  - q: "Faut-il une carte entreprise pour télécharger le véhicule ?"
    a: "<p>Oui, le téléchargement de la mémoire du chronotachygraphe se fait avec la carte entreprise insérée (ou à distance via un boîtier télématique qui l’utilise). Elle permet aussi de verrouiller les données de l’entreprise pour qu’une autre entreprise ne puisse pas les lire.</p>"
  - q: "La vitesse est-elle enregistrée en permanence ?"
    a: "<p>La vitesse détaillée, seconde par seconde, n’est conservée que pour les dernières 24 heures de conduite. Au-delà, il ne reste que les événements d’excès de vitesse.</p>"
---

Le chronotachygraphe du camion, appelé **unité embarquée**, garde en mémoire bien plus que la carte d’un conducteur : toute l’activité du véhicule pendant au moins un an, tous conducteurs confondus. Son téléchargement produit, lui aussi, un fichier **.DDD** (parfois .V1B ou .ESM), avec une structure différente de celle de la carte.

## Ce que contient le fichier

Le téléchargement est découpé en plusieurs blocs :

| Bloc | Contenu |
|---|---|
| Vue d’ensemble | numéro de série (VIN), immatriculation, heure de l’appareil, période téléchargeable, cartes présentes, téléchargements précédents, verrous d’entreprise, contrôles |
| Activités | pour chaque jour : kilométrage à minuit, insertions et retraits de cartes (nom du conducteur, numéro de carte, kilomètres), changements d’activité des deux fentes, lieux de début et de fin de journée |
| Événements et défauts | conduite sans carte, insertion pendant la conduite, coupures d’alimentation, excès de vitesse, réglages de l’heure, pannes |
| Vitesse détaillée | la vitesse seconde par seconde des dernières 24 heures de conduite |
| Données techniques | fabricant et numéro de l’appareil, capteur de mouvement, historique des étalonnages |

Les appareils intelligents (deuxième génération) y ajoutent les positions GNSS, et la deuxième version les passages de frontières et les chargements.

## Ce qu’on y cherche en pratique

- **Qui a conduit le véhicule, et quand** : chaque insertion de carte est enregistrée avec le nom du conducteur et le kilométrage.
- **La conduite sans carte** : le véhicule a roulé alors qu’aucune carte n’était insérée. C’est l’un des premiers points regardés lors d’un contrôle en entreprise.
- **Les excès de vitesse** : chaque dépassement de la vitesse maximale autorisée de l’appareil (le plus souvent 90 km/h pour un camion) pendant plus d’une minute est consigné avec la vitesse maximale et moyenne.
- **Les étalonnages** : l’appareil doit être contrôlé par un atelier agréé au moins tous les deux ans ; chaque intervention est enregistrée.
- **L’heure de l’appareil** : un écart ou des réglages d’heure fréquents méritent une explication.

## Le téléchargement

La mémoire du véhicule doit être téléchargée **au moins tous les 90 jours** (jours d’activité), et les données conservées **au moins 12 mois** par l’entreprise. Le téléchargement se fait avec la carte entreprise et une clé de téléchargement, ou à distance.

La carte entreprise sert aussi à poser un **verrou** : tant qu’il est actif, les données enregistrées pendant cette période ne sont lisibles que par l’entreprise qui l’a posé. On le retire quand le véhicule change de mains.

## Lire le fichier

Le [lecteur de fichiers véhicule](/lire-fichier-ddd-vehicule/) affiche la vue d’ensemble, les conducteurs jour par jour, les périodes de conduite sans carte, les excès de vitesse, la vitesse détaillée et les étalonnages. Comme pour les cartes, le fichier est lu dans votre navigateur et n’est envoyé nulle part.

Pour le fichier de la carte d’un conducteur, voir [le fichier DDD de la carte conducteur](/guides/lire-fichier-ddd-carte-conducteur/).
