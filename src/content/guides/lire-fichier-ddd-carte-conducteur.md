---
title: "Le fichier DDD de la carte conducteur : ce qu’il contient et comment le lire"
seoTitle: "Fichier DDD carte conducteur : contenu, structure et lecture"
description: "Ce que contient un fichier DDD de carte conducteur : identité, activités minute par minute, véhicules, lieux, événements. Sa structure, et comment l’ouvrir."
keywords: ["fichier ddd", "fichier ddd carte conducteur", "ouvrir fichier ddd", "format ddd tachygraphe", "fichier c1b", "fichier tgd", "fichier esm", "contenu carte conducteur", "activités carte conducteur", "lecture carte chronotachygraphe", "données carte tachygraphe", "carte conducteur 28 jours"]
published: 2026-11-11
faq:
  - q: "Quelle différence entre .DDD, .C1B, .TGD et .ESM ?"
    a: "<p>Aucune sur le fond : c’est le même contenu, défini par la réglementation européenne. L’extension dépend du logiciel ou de l’appareil qui a fait le téléchargement.</p>"
  - q: "Peut-on modifier un fichier DDD ?"
    a: "<p>Techniquement, on peut modifier n’importe quel fichier, mais chaque bloc de données est signé par la carte : toute modification se voit lors de la vérification de la signature. Falsifier des données de chronotachygraphe est un délit.</p>"
  - q: "Combien de jours contient une carte ?"
    a: "<p>Au moins 28 jours d’activité pour une carte de première génération, et 56 jours pour les cartes intelligentes récentes, à raison d’environ 93 changements d’activité par jour en moyenne. Au-delà, les journées les plus anciennes sont écrasées.</p>"
---

Quand on télécharge une carte conducteur, on obtient un fichier, le plus souvent avec l’extension **.DDD**. Ce fichier n’est pas un export « lisible » : c’est la copie de la mémoire de la carte, dans le format défini par la réglementation européenne. Voici ce qu’il contient, et pourquoi il ne s’ouvre pas dans Excel.

## Une suite de petits fichiers

La puce d’une carte conducteur contient une série de **fichiers élémentaires**, chacun avec un identifiant. Le fichier DDD les met bout à bout, chacun précédé d’un petit en-tête de cinq octets :

```
[identifiant : 2 octets][type : 1 octet][longueur : 2 octets][données…]
```

Le type indique s’il s’agit de données ou d’une **signature**, et à quelle génération elles appartiennent. Une carte intelligente contient en fait deux jeux de données, un pour chaque génération, pour rester lisible par les anciens appareils.

## Ce que l’on y trouve

| Fichier | Contenu |
|---|---|
| Identification | nom, prénoms, date de naissance, numéro de carte, pays et autorité de délivrance, dates de validité |
| Permis de conduire | numéro et pays du permis |
| Activités | chaque changement d’activité, à la minute, jour par jour |
| Véhicules utilisés | immatriculation, dates et kilométrage de chaque véhicule ; numéro de série (VIN) sur les cartes récentes |
| Lieux | pays de début et de fin de chaque journée de travail ; position GNSS sur les cartes intelligentes |
| Événements et défauts | conduite sans carte, insertion pendant la conduite, coupures d’alimentation, excès de vitesse, pannes |
| Contrôles | date, type et véhicule des contrôles routiers |
| Conditions particulières | périodes hors champ, traversées en ferry ou en train |
| Dernier téléchargement | date du dernier téléchargement de la carte |

Les cartes intelligentes de deuxième version ajoutent les **passages de frontières** et les **opérations de chargement et de déchargement**.

## Les activités, minute par minute

C’est le cœur du fichier. Pour chaque jour, la carte enregistre la liste des changements d’activité. Chacun tient en deux octets, qui indiquent :

- l’**activité** : conduite, travail, disponibilité ou repos ;
- l’**heure** du changement, à la minute ;
- si la carte était **insérée** ou non, et dans quelle fente (conducteur ou deuxième conducteur) ;
- si le véhicule roulait en **équipage** ;
- quand la carte était retirée, si l’activité a été **saisie manuellement** ou reste inconnue.

Ces enregistrements sont rangés dans un **tampon circulaire** : quand la mémoire est pleine, le jour le plus récent écrase le plus ancien. D’où l’obligation de [télécharger la carte au moins tous les 28 jours](/guides/telechargement-carte-conducteur-28-jours/).

Toutes les heures sont en **temps universel (UTC)**. En France, il faut ajouter une heure en hiver et deux en été pour retrouver l’heure légale.

## Les signatures

Chaque bloc de données est suivi de sa signature numérique, calculée par la puce de la carte. Elle permet à un logiciel agréé ou à un contrôleur de vérifier que le fichier n’a pas été modifié après le téléchargement.

## Comment le lire

Il existe des logiciels d’analyse agréés, souvent payants, utilisés par les entreprises de transport. Pour simplement consulter une carte, le [lecteur de fichiers DDD](/) affiche :

- l’identité de la carte et sa date d’expiration ;
- une frise de 24 heures pour chaque journée, avec les totaux de conduite, travail, disponibilité et repos ;
- les véhicules, les lieux, les événements, les défauts et les contrôles ;
- les **infractions probables** aux temps de conduite et de repos.

Le fichier est décodé par votre navigateur et n’est envoyé nulle part. Le contenu peut être exporté vers Excel.

Pour comprendre les règles appliquées, voir [temps de conduite et de repos : les règles](/guides/temps-de-conduite-repos-reglementation/).
