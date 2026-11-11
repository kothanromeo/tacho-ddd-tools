<div align="center">

# Tacho DDD Tools

**Lire les fichiers de chronotachygraphe (.DDD) — carte conducteur et véhicule — et contrôler les temps de conduite et de repos, dans le navigateur.**

[**→ Lecteur de cartes**](https://tacho-ddd-tools.kothanromeo.dev/) · [Lecteur de véhicules](https://tacho-ddd-tools.kothanromeo.dev/lire-fichier-ddd-vehicule/) · [Calcul du temps de conduite](https://tacho-ddd-tools.kothanromeo.dev/calcul-temps-de-conduite/) · [Guides](https://tacho-ddd-tools.kothanromeo.dev/guides/) · [Signaler un problème](https://github.com/kothanromeo/tacho-ddd-tools/issues)

![Tests](https://github.com/kothanromeo/tacho-ddd-tools/actions/workflows/ci.yml/badge.svg)
![Licence MIT](https://img.shields.io/badge/licence-MIT-blue)

</div>

---

Un fichier de carte conducteur contient le nom, les horaires et les déplacements d'une personne. Le lire demande en général un logiciel payant ou l'envoi du fichier à un service en ligne. Tacho DDD Tools le décode entièrement dans le navigateur.

## Fonctionnalités

- **Lecture** des fichiers de carte conducteur (.DDD, .C1B, .TGD, .ESM) de 1re génération (annexe 1B) et de 2e génération (annexe 1C), y compris les cartes intelligentes V2 : les deux jeux de données d'une carte G2 sont lus et fusionnés.
- **Contenu affiché** : identité, permis, activités minute par minute (tampon circulaire, saisies manuelles, équipage), véhicules (avec VIN), lieux (avec position GNSS), événements, défauts, contrôles, conditions particulières, passages de frontières.
- **Analyse** selon le règlement (CE) 561/2006 : pause après 4 h 30, conduite journalière (9 h / 10 h), repos journalier dans la fenêtre de 24 h (normal, fractionné, réduit, équipage 30 h), repos hebdomadaire (six périodes de 24 h, deux réduits consécutifs signalés « à vérifier »), 56 h par semaine, 90 h sur deux semaines.
- **Affichage** en heure de Paris ou en UTC, frise de 24 h par jour, totaux hebdomadaires.
- **Export Excel** : jours, activités, constats, semaines, véhicules, lieux, événements.
- **Fichiers de véhicule** (unité embarquée, TREP 01 à 05, 21 à 25, 31 à 35) : vue d'ensemble, insertions de cartes, activités des deux fentes, **conduite sans carte**, lieux, événements et défauts, excès de vitesse, réglages d'heure, **vitesse détaillée** (courbe seconde par seconde), identification de l'appareil, capteur et **étalonnages** ; points d'attention et export Excel.
- **Calculateur** de temps de conduite restant, sans fichier.

## Structure

```
src/lib/tacho/
├── bytes.ts      Types de base (TimeReal, Datef, BCD, noms avec page de code)
├── card.ts       Carte : découpage du fichier, décodage des fichiers élémentaires, fusion G1/G2
├── vu.ts         Véhicule : transferts, tableaux d'enregistrements G2, points d'attention
├── vu-export.ts  Export XLSX d'un fichier de véhicule
├── vu-sample.ts  Téléchargement de véhicule entièrement fictif
├── codes.ts      Pays, événements et défauts, types d'entrée, contrôles
├── timeline.ts   Chronologie continue, fuseaux horaires, découpage par jour
├── rules.ts      Contrôle des temps de conduite et de repos
├── remaining.ts  Temps de conduite restant
├── export.ts     Export XLSX
└── sample.ts     Carte entièrement fictive (exemple et tests)
src/scripts/      ddd-ui.ts, vu-ui.ts, calc-ui.ts
```

## Développement

```bash
npm install
npm run dev     # http://localhost:4321/
npm test        # tests Vitest
npm run build   # site statique dans dist/
```

Les tests utilisent une carte et un véhicule fictifs générés par `sample.ts` et `vu-sample.ts`. Les décodeurs ont en plus été vérifiés sur des cartes et des téléchargements de véhicules réels anonymisés, de première et de deuxième génération.

## Limites

- Les signatures sont détectées mais pas vérifiées.
- L'analyse est indicative : ferries et trains, dérogations nationales, circonstances exceptionnelles et activités hors champ ne sont pas pris en compte. Elle ne remplace pas un logiciel d'analyse agréé.

## Contribuer

Issues et pull requests bienvenues. **Ne publiez jamais un fichier de carte réel** : il contient des données personnelles.

## Licence

[MIT](LICENSE) © Roméo Kothan
