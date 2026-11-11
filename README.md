<div align="center">

# Tacho DDD Tools

**Lire un fichier de carte conducteur de chronotachygraphe (.DDD) et contrôler les temps de conduite et de repos, dans le navigateur.**

[**→ Ouvrir le lecteur**](https://tacho-ddd-tools.kothanromeo.dev/) · [Calcul du temps de conduite](https://tacho-ddd-tools.kothanromeo.dev/calcul-temps-de-conduite/) · [Guides](https://tacho-ddd-tools.kothanromeo.dev/guides/) · [Signaler un problème](https://github.com/kothanromeo/tacho-ddd-tools/issues)

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
- **Calculateur** de temps de conduite restant, sans fichier.

## Structure

```
src/lib/tacho/
├── bytes.ts      Types de base (TimeReal, Datef, BCD, noms avec page de code)
├── card.ts       Découpage du fichier, décodage des fichiers élémentaires, fusion G1/G2
├── codes.ts      Pays, événements et défauts, types d'entrée, contrôles
├── timeline.ts   Chronologie continue, fuseaux horaires, découpage par jour
├── rules.ts      Contrôle des temps de conduite et de repos
├── remaining.ts  Temps de conduite restant
├── export.ts     Export XLSX
└── sample.ts     Carte entièrement fictive (exemple et tests)
src/scripts/      ddd-ui.ts, calc-ui.ts
```

## Développement

```bash
npm install
npm run dev     # http://localhost:4321/
npm test        # tests Vitest
npm run build   # site statique dans dist/
```

Les tests utilisent une carte fictive générée par `sample.ts`. Le décodeur a en plus été vérifié sur des cartes réelles anonymisées des deux générations.

## Limites

- Les fichiers d'unité embarquée (mémoire du véhicule) ne sont pas encore lus.
- Les signatures sont détectées mais pas vérifiées.
- L'analyse est indicative : ferries et trains, dérogations nationales, circonstances exceptionnelles et activités hors champ ne sont pas pris en compte. Elle ne remplace pas un logiciel d'analyse agréé.

## Contribuer

Issues et pull requests bienvenues. **Ne publiez jamais un fichier de carte réel** : il contient des données personnelles.

## Licence

[MIT](LICENSE) © Roméo Kothan
