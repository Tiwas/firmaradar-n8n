# Changelog

Alle merkbare endringer i `n8n-nodes-firmaradar` dokumenteres her.

Formatet følger [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
og prosjektet bruker [SemVer](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.8.0] — 2026-08-07

### Added

- **`Hent regnskapsrapport` (`getRegnskapsrapport`) — ny operasjon på
  `Firmaradar — Selskap`.** Bestiller en ferdig formatert regnskapsrapport
  (Excel eller PDF; samme builder som portalens
  `/minbedrift/regnskap/<orgnr>/rapport.xlsx`/`.pdf`) via
  `GET /api/v1/regnskapsrapport/{orgnr}` og returnerer metadata + et
  kortlevd (~15 min), signert nedlastings-URL — **aldri** filen selv.
  Skiller seg fra `Hent regnskap` (`getFinancials`), som gir rå tall til
  videre beregning: denne operasjonen leverer et **ferdig dokument**
  (samme oppsett/kildenote som en kunde ville lastet ned i portalen),
  klart for arkivering/videresending. Ny felt-input: **Format**
  (PDF/Excel), **Regnskapstype** (Selskap/Konsern) og **Antall
  regnskapsår** (maks 5, håndhevet server-side). Krever `excel_feed`-
  tilgang (xlsx) eller `print_til_pdf`-tilgang (pdf) på kontoen; koster
  1 kreditt per levert regnskapsår.
- **To-nivå FIV-vurdering (selskap + konsern) på `checkFiv`/`checkFivBulk`**
  — jf. GBER (EU-forordning 651/2014) art. 2(18). FIV-vurderingen gjøres
  nå på **to nivåer**; det er tilstrekkelig at ett av nivåene slår til.
  Nye felter i responsen: `company_status` (selskaps-leddet alene, før
  konsern-leddet ble lagt på), `distress_basis`
  (`company`/`group`/`company_and_group`/`null`), `group_assessment`
  (konsern-vurderingsobjekt: status, basis, rot-orgnr, medlemstall,
  kapitaltapsandel), `rescuable_by_group` (boolean) og `rescue_estimate`
  (hva konsernet må tilføre for å reparere kapitalkriteriet — nullable,
  satt kun ved «Ja (!)»). `checkFivBulk` svarer med de samme feltene per
  orgnr i `results[]`. Kundevendt status kan nå bli **«Ja (konsern)»**
  (kun konsern-leddet trigget), **«Ja (!)»** (selskapet rødt alene, men
  konsernet er verifisert friskt og kan reparere før godkjennings-
  tidspunktet) eller **«Tvil»** (konsern-leddet kan ikke fastslås, f.eks.
  fordi gratis BRREG-API ikke eksponerer konserndata).

## [0.7.0] — 2026-07-16

### Fixed

- **Rettet døde API-paths — flere operasjoner traff ruter som ikke finnes i
  backend** (verifisert mot prod 2026-07-16; funnet under byggingen av
  Activepieces-piecen, som brukte openapi-kontrakten som fasit):
  - `Selskap.Søk selskaper`: `/api/v1/search/companies` → kanonisk
    `GET /api/v1/companies/search`.
  - `Selskap.Hent kunngjøringer`: `/company/{orgnr}/announcements` → kanonisk
    `/company/{orgnr}/changes` (announcements-pathen er kun
    dokumentasjons-alias i openapi).
  - `Selskap.Hent regnskap`: `/company/{orgnr}/financials` → kanonisk
    `GET /api/regnskap/{orgnr}/historikk`.
  - `Person.Søk personer`: `/api/v1/search/persons` → kanonisk
    `/api/v1/person/search`.
  - `Person.Hent roller`: `/person/{id}/roles` → kanonisk
    `/api/v1/person/roles/{role_person_id}` (nøkkel fra søkets
    `role_persons[].id`).
  - `Person.Hent selskaper`: `/person/{id}/companies` → kanonisk
    `/api/v1/person/shareholdings/{owner_person_key}` (nøkkel fra søkets
    `shareholders[].id`).
  - `Bransje.List selskaper i NACE`: `/api/v1/nace/companies?nace=` →
    kanonisk `/api/v1/nace/{code}/companies`.
  - `Bransje.Sammenlikne selskaper`: GET m/ query → kanonisk
    `POST /api/v1/companies/compare` med JSON-body (`GET` ga 405).
  - Credential-testen: `/api/v1/health/ping` (finnes ikke) → autentisert
    `GET /api/v1/companies/search?q=firmaradar&limit=1`.
- **`Sjekk AML/PEP` bruker nå riktig kontrakt.** Endepunktet
  `POST /api/v1/aml/check` er PERSON-screening (`AmlCheckRequest`) — noden
  sendte `{orgnr}` uten DPA-headerne og ble avvist. Nye felter: Navn
  (påkrevd), Fødselsår, Kategori (begge/sanksjon/PEP), Minimum match-ratio;
  DPA-headerne (`X-FR-Purpose` + `X-FR-DPA-Confirmed`) sendes som på
  `Start AML-rapport`.

### Removed

- **«Hent skattelister (selskap)»-operasjonen** er fjernet fra
  `Firmaradar — Offentlige data`. Konsernstøtte-operasjonene er uendret.
- **`Person.Hent person` er fjernet.** Operasjonen pekte på en rute som
  aldri har eksistert i backend (person-profilen er klient-side-
  orkestrering i MCP-serveren) og har derfor aldri fungert. Bruk
  `Søk personer` + `Hent roller`/`Hent selskaper`.

### Changed

- Eksempel-arbeidsflytene (`kyc-onboarding`, `due-diligence-rapport`) er
  oppdatert til navnebasert AML-screening og `hit_count`-feltet i svaret.
- «Hent IP-portefølje» bruker nå det dedikerte `/api/v1/company/{orgnr}/ip`-endepunktet
  (renere enn `?ip=1` på Get Company). Uendret utdata (`ip_rettigheter`).
- **`Hent AML-score` (`getAmlScore`) er utfaset og lagt om til async
  rapport-flyt.** Backend-endepunktet `POST /api/v1/aml/score` er deprecert
  (2026-07-07) og svarer nå `202 Accepted` med `rapport_id` + `poll_url`
  (+ `deprecated: true`) i stedet for å blokkere til rapporten er ferdig.
  Operasjonen sender nå DPA-headerne (`X-FR-Purpose` +
  `X-FR-DPA-Confirmed`) som backend krever, og resultatet kjedes videre
  med `Hent AML-rapport (poll)` til status er `done`/`failed`. Bruk
  `Start AML-rapport (async)` + `Hent AML-rapport (poll)` i nye
  arbeidsflyter.

### Added

- **`Firmaradar Trigger` — instant/webhook-trigger-node.** Første trigger i
  pakken. Starter en arbeidsflyt når Firmaradar registrerer en hendelse:
  - **Overvåk et selskap (orgnr)** — kunngjøring, status-, eier- eller
    tilskuddsendring for ett selskap (`POST /api/v1/monitoring/webhooks`).
  - **Overvåk en bransje (NACE)** — hendelser for alle selskap i en NACE-kode,
    med hendelsestype-, geo- (fylke/kommune/landsdel) og størrelses-filtre
    (`POST /api/v1/nace/subscriptions`).

  Noden registrerer sin egen n8n-webhook-URL som callback ved aktivering og
  avbestiller abonnementet (DELETE) ved deaktivering. Valgfri
  leverings-hemmelighet sendes som `Authorization: Bearer` — og verifiseres
  av noden på mottak: leveranser som mangler eller har feil hemmelighet
  droppes før arbeidsflyten starter. For NACE kan i tillegg en
  signerings-hemmelighet settes; da HMAC-signerer Firmaradar leveransene
  (`X-Firmaradar-Signature`, SHA-256 over rå body) og noden dropper
  leveranser med manglende eller ugyldig signatur
  (`webhookVerification.ts`).
- **Batch-agentiske operasjoner på `Firmaradar — KYC og AML`** — eksponerer de
  samme mønstrene som MCP-serveren og Make-appen:
  - **Bulk: foretak i vanskeligheter** (`checkFivBulk`) — FIV-screening av opptil
    50 orgnr i ett kall (`POST /api/v1/fiv/bulk`). Per-orgnr compliance-gate
    returneres som per-orgnr `error`; 1 enhet/orgnr mot kvoten.
  - **Bulk: risikoscore** (`getRiskScoreBulk`) — risikoscore for opptil 50 orgnr
    (`POST /api/v1/risikoscoring/score/bulk`).
  - **Start AML-rapport (async)** (`startAmlReport`) — starter AML-rapport i
    bakgrunnen (`POST /api/v1/aml/report` → `rapport_id` + status «pending»).
    Sender DPA-headers (`X-FR-Purpose` + `X-FR-DPA-Confirmed: true`); rate-limit
    50 kall / 30 min; rapport lagres i 60 mnd (Hvitvaskingsloven §35).
  - **Hent AML-rapport (poll)** (`getAmlReport`) — poller async-rapport-status
    (`GET /api/v1/aml/report/{report_id}`) til `done`/`failed`.
  - Ny felt-input: `orgnrs` (komma/mellomrom/linjeskift-separert liste) for
    bulk-operasjonene, `Rapport-ID` for polling, og `Hopp over ferskhets-sjekk`
    for bulk-FIV. `Formål med oppslaget` gjelder nå også `startAmlReport`.

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
