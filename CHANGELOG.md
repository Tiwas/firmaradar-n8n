# Changelog

Alle merkbare endringer i `n8n-nodes-firmaradar` dokumenteres her.

Formatet følger [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
og prosjektet bruker [SemVer](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] — 2026-06-19

### Added

- **`Hent IP-portefølje` (getIp) — egen operasjon på Firmaradar — Selskap.**
  Henter selskapets immaterielle rettigheter (patenter, varemerker og design fra
  Patentstyret) som en dedikert handling og returnerer `ip_rettigheter` direkte.
  Gjør IP like oppdagbar som regnskap/roller/eierskap i stedet for å være en
  `fields`-verdi på `Hent selskap`.

---

## [0.4.0] — 2026-06-19

### Added

- **`Hent selskap` — valgfrie tilleggsfelt (`fields`).** Ny multi-select som
  beriker selskapsprofilen med opt-in-seksjoner: konsernstruktur, eiere
  (virksomhet/alle), offentlig støtte, BRREG-tildelinger, **immaterielle
  rettigheter (patenter/varemerker/design fra Patentstyret)**, nylige endringer
  og regnskaps-nøkkeltall. Speiler `fields`-parameteren i MCP/REST-API-et.

---

## [0.3.0] — 2026-05-27

Første offentlige release på npm. Speiler MCP v0.3 (#130) og inneholder
22 operasjoner totalt på tvers av fem node-typer.

### Added

- **KYC og AML — 3 nye v0.3-operasjoner:**
  - `Get AML score` — strukturert AML-score 0–100 med faktor-breakdown
    via `POST /api/v1/aml/score` (server-side to-kall-flyt; klienten ser
    én strukturert respons).
  - `Get risk score` — generell risikoscore 0–100 + nivå
    (lav/moderat/høy/kritisk) + komponent-breakdown via
    `GET /api/v1/risikoscoring/score/{orgnr}`.
  - `Check foretak i vanskeligheter` — FIV-status (a–e-regler) via
    `GET /api/v1/fiv/assess/{orgnr}`.
- **Offentlige data — 3 nye v0.3-operasjoner:**
  - `Get konsernstøtte` — tre-struktur med `selskap_stotte` per node og
    `konsern_aggregat` på rot-noden (post-#134-vokabular). Ny valgfri
    boolean-parameter **«Flat ut treet»** som returnerer én n8n-item per
    selskap i stedet for hele tre-strukturen.
  - `Get konsernstøtte-historikk` — flat liste over enkelt-tildelinger
    med kilde-filter (Innovasjon Norge / SkatteFUNN / Andre).
  - `Get skattelister (selskap)` — inntekt, formue og skatt per
    skatteår. Krever full tilgang og audit-logges per oppslag.
- **Workflow-eksempler i `workflows/`:**
  - `kyc-onboarding.json` — Webhook → AML/PEP + risikoscore + eierskap →
    Slack-varsel hvis risiko-nivå er høy/kritisk.
  - `due-diligence-rapport.json` — Manuell trigger → konsern-tre → loop
    over hver node → finansrollup + AML + konsernstøtte → samle i
    Google Sheets.
  - `nace-overvakning.json` — Daglig schedule → liste i NACE-kode →
    loop → siste endringer → filtrer på relevans → e-post-digest.
- **Build-konfig for publish-løyper:**
  - `.eslintrc.js` (vanlig lint mot `plugin:n8n-nodes-base/community`).
  - `.eslintrc.prepublish.js` (strict-lint mot
    `plugin:n8n-nodes-base/community-strict`, trigget av
    `prepublishOnly`).
  - `.npmignore` som whitelistsikrer at kun `dist/`, `package.json`,
    `README.md`, `CHANGELOG.md` og `LICENSE` havner i tarballen.
- **GitHub Actions publish-workflow** med OIDC-basert provenance —
  `.github/workflows/publish.yml`. Trigges på tag `v*.*.*`.

### Changed

- **Path-fix (kritisk):** Alle KYC- og Offentlige-data-operasjoner
  peker nå på de kanoniske `/api/v1/...`-stiene i stedet for tidligere
  `/ext/...`-stiene som ikke lenger eksisterer:
  - KYC: `getAmlScore`, `getRiskScore`, `checkFiv`.
  - Offentlige: `getKonsernstotte`, `getKonsernstotteHistorikk`,
    `getSkattelisterSelskap`.
- **`Get AML score` er nå ett kall (ikke to).** Backend gjør
  generér-rapport-+-hent-rapport server-side via `POST /api/v1/aml/score`;
  klienten får én strukturert respons.
- **Credentials-header:** `X-MCP-Client: n8n-nodes-firmaradar` →
  `X-FR-Client: n8n`. n8n er ikke en MCP-agent, og backend kan derfor
  gi n8n-trafikk riktig rate-limit-tier og audit-tagging.
- **Peer-dependency `n8n-workflow` pinnet til `>=1.0 <2.0`** for å
  forhindre at en n8n 2.x-major fyrer av brytende endringer i
  community-instanser ved transitive oppdateringer.
- **`publishConfig` lagt til** i `package.json` med
  `access: "public"`, `registry: "https://registry.npmjs.org/"` og
  `provenance: true`.
- **Fjernet `"main": "index.js"`** fra `package.json`. n8n laster noder
  via `n8n.nodes`-arrayen, ikke via `main`, så feltet var dødvekt og
  pekte på en fil som ikke fantes.

### Documentation

- README oppdatert fra «17 operasjoner» til «22 operasjoner» med
  fullstendig operasjons-tabell og API-endepunkter per rad.
- Ny seksjon i README som forklarer `selskap_stotte` vs
  `konsern_aggregat` etter #134-rename.
- Bumpet versjons-historikk i README og lagt til peker til
  CHANGELOG.md.

### Removed

- Tidligere `/ext/aml_rapport/generer`-+-`/ext/aml_rapport/rapport/`-
  flow erstattet av en enkelt `POST /api/v1/aml/score`-kall.

---

## [0.1.0] — 2026-05-23 *(internt skjelett, ikke npm-publisert)*

Initial skjelett-versjon, brukt internt under #131-planlegging.
Inneholdt 17 operasjoner mot MCP v0.2. **Ikke publisert til npm** —
overskredet av 0.3.0 i samme commit-rekke.

---

[0.5.0]: https://github.com/Tiwas/firmaradar-n8n/releases/tag/v0.5.0
[0.4.0]: https://github.com/Tiwas/firmaradar-n8n/releases/tag/v0.4.0
[0.3.0]: https://github.com/Tiwas/firmaradar-n8n/releases/tag/v0.3.0
[0.1.0]: https://github.com/Tiwas/firmaradar-n8n/releases/tag/v0.1.0
