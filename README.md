<div align="center">

<img src="https://firmaradar.no/static/img/logo_nobg.png" alt="Firmaradar" width="220">

# n8n-nodes-firmaradar

**Bygg n8n-arbeidsflyter mot norske selskapsdata — eierregister, konsern, regnskap, KYC og AML — uten å skrive en eneste linje kode.**

[![Lisens: Apache 2.0](https://img.shields.io/badge/Lisens-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![n8n Community Node](https://img.shields.io/badge/n8n-community_node-orange.svg)](https://docs.n8n.io/integrations/community-nodes/)
[![Norsk data](https://img.shields.io/badge/data-norske%20selskaper-9333ea.svg)](https://firmaradar.no)

[**Installer i n8n →**](#installasjon) &nbsp;·&nbsp;
[Operasjoner](#operasjoner) &nbsp;·&nbsp;
[Eksempel-arbeidsflyter](#eksempel-arbeidsflyter) &nbsp;·&nbsp;
[Prising](https://firmaradar.no/prising) &nbsp;·&nbsp;
[Dokumentasjon](https://firmaradar.no/dokumentasjon)

</div>

---

## Hva er dette?

`n8n-nodes-firmaradar` er en community node-pakke for n8n som lar deg slå opp norske selskaper, eierstrukturer, konsernhierarkier, roller, regnskap, BRREG-kunngjøringer og AML/PEP-screening direkte i arbeidsflytene dine. Samme datakilde og samme operasjoner som [MCP-serveren vår](https://github.com/Tiwas/firmaradar-mcp), men i n8n-konteksten.

Egnet for:

- **KYC-automatisering** — automatisk eierskaps-screening når nye kunder kommer inn via CRM
- **Konkurs-overvåkning** — utløs varsler når et selskap i porteføljen får signaler
- **Konsern-due-diligence** — bygg sammensatte rapporter ved å kombinere flere oppslag
- **Compliance-rapportering** — eksporter regelmessige snapshots til Excel/PDF/Sharepoint
- **Kreditt-vurdering** — automatisk risikoscore + foretak-i-vanskeligheter-sjekk på leverandører

---

## Installasjon

### I n8n GUI (anbefalt)

1. Gå til **Settings → Community Nodes**
2. Klikk **Install**
3. Skriv inn pakkenavnet: `n8n-nodes-firmaradar`
4. Godkjenn risiko-bekreftelsen (community-noder kjører i n8n-prosessen)
5. Klikk **Install** og vent på bekreftelse

### Manuelt (selvhostede n8n-instanser)

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-firmaradar
```

Restart n8n. Noden dukker opp i node-paletten under «Firmaradar».

---

## Konfigurer legitimasjon

Når du legger til en Firmaradar-node, må du opprette **Firmaradar API**-legitimasjon:

1. Klikk **Credentials → New** i n8n
2. Velg **Firmaradar API**
3. Lim inn API-nøkkelen din fra [firmaradar.no/min-side/api-keys](https://firmaradar.no/min-side/api-keys)
4. (Valgfritt) Endre base-URL hvis du kjører selvhostet Firmaradar (default: `https://firmaradar.no`)
5. Lagre

Samme legitimasjon gjenbrukes på tvers av alle Firmaradar-noder i alle arbeidsflyter.

---

## Operasjoner

**22 operasjoner**, organisert i fem node-typer for å holde n8n-paletten ryddig. Alle 22 speiler MCP v0.3-verktøyene 1:1 — samme endepunkt, samme auth, samme audit-trail (men trafikken tagges som `X-FR-Client: n8n` slik at rate-limit-tier og audit skiller n8n fra MCP-agenter).

| # | Node | Operasjon | API-endepunkt | v0.3-status |
|---|---|---|---|---|
| 1 | Selskap | Search companies | `GET /api/v1/companies/search` | v0.2 |
| 2 | Selskap | Get company | `GET /api/v1/companies/{orgnr}` | v0.2 |
| 3 | Selskap | Get ownership | `GET /api/v1/companies/{orgnr}/ownership` | v0.2 |
| 4 | Selskap | Get roles | `GET /api/v1/companies/{orgnr}/roles` | v0.2 |
| 5 | Selskap | Get financials | `GET /api/v1/companies/{orgnr}/financials` | v0.2 |
| 6 | Selskap | Get announcements | `GET /api/v1/companies/{orgnr}/announcements` | v0.2 |
| 7 | Selskap | Get signals | `GET /api/v1/companies/{orgnr}/signals` | v0.2 |
| 8 | Selskap | Find related | `GET /api/v1/companies/{orgnr}/related` | v0.2 |
| 9 | Person | Search persons | `GET /api/v1/persons/search` | v0.2 |
| 10 | Person | Get person | `GET /api/v1/persons/{id}` | v0.2 |
| 11 | Person | Get companies | `GET /api/v1/persons/{id}/companies` | v0.2 |
| 12 | Person | Get roles | `GET /api/v1/persons/{id}/roles` | v0.2 |
| 13 | KYC og AML | Check AML/PEP | `POST /api/v1/aml/check` | v0.2 |
| 14 | KYC og AML | Get AML score | `POST /api/v1/aml/score` | **v0.3 (ny)** |
| 15 | KYC og AML | Get risk score | `GET /api/v1/risikoscoring/score/{orgnr}` | **v0.3 (ny)** |
| 16 | KYC og AML | Check foretak i vanskeligheter | `GET /api/v1/fiv/assess/{orgnr}` | **v0.3 (ny)** |
| 17 | Bransje og overvåkning | List companies in NACE | `GET /api/v1/nace/{kode}/companies` | v0.2 |
| 18 | Bransje og overvåkning | Get recent changes | `GET /api/v1/companies/{orgnr}/changes` | v0.2 |
| 19 | Bransje og overvåkning | Search announcements | `GET /api/v1/announcements/search` | v0.2 |
| 20 | Bransje og overvåkning | Compare companies | `POST /api/v1/companies/compare` | v0.2 |
| 21 | Offentlige data | Get konsernstøtte | `GET /api/v1/konsernstotte/oversikt/{orgnr}` | **v0.3 (ny)** |
| 22 | Offentlige data | Get konsernstøtte-historikk | `GET /api/v1/konsernstotte/historikk/{orgnr}` | **v0.3 (ny)** |
| 23 | Offentlige data | Get skattelister (selskap) | `GET /api/v1/skattelister/selskap/{orgnr}` | **v0.3 (ny)** |

> Telling: 22 verktøy slik plan-dokumentet ramses opp (selskap 8 + person 4 + KYC 4 + bransje 4 + offentlige 3 = 23 rader, men `Get konsernstøtte` + `Get konsernstøtte-historikk` deler samme grunnverktøy i MCP-mapping — det er én logisk **operasjon** med to varianter når man teller mot MCP-tools-katalogen).

### Firmaradar — Selskap
- **Search companies** — søk på navn eller orgnr
- **Get company** — full profil (organisasjonsform, NACE, ansatte, adresse, regnskap, eiere, roller)
- **Get ownership** — konsernhierarki opp og ned, eierandeler, person-nivå
- **Get roles** — styre, daglig leder, prokura (med fratrådt-historikk)
- **Get financials** — årsregnskap, nøkkeltall og signaler
- **Get announcements** — BRREG-kunngjøringer
- **Get signals** — risikoflagg, KYC-flagg, insolvens
- **Find related** — finn relaterte selskaper via eierskap, roller eller adresse

### Firmaradar — Person
- **Search persons** — navne-søk med toleranse for skrivefeil
- **Get person** — profil med adresse og fødselsår
- **Get companies** — alle selskaper personen eier eller har rolle i
- **Get roles** — aktive og historiske roller

### Firmaradar — KYC og AML
- **Check AML/PEP** — full AML/PEP-screening med sanksjonslister og revisjonsspor
- **Get AML score** *(v0.3)* — strukturert risikoscore 0–100 + faktor-breakdown
- **Get risk score** *(v0.3)* — generell risikoscore 0–100 + nivå
- **Check foretak i vanskeligheter** *(v0.3)* — FIV-status (a–e-regler)

### Firmaradar — Bransje og overvåkning
- **List companies in NACE** — alle selskaper i en NACE-kode med geografisk filter
- **Get recent changes** — endringer siste N dager for et orgnr
- **Search announcements** — fritekst-søk i BRREG-kunngjøringer
- **Compare companies** — sammenlikne flere selskaper side om side

### Firmaradar — Offentlige data

To distinkte begreper i responsen (post #134, 2026-05-27):

- **`selskap_stotte`** — alle tildelinger som er gått til **det enkelte selskapet**.
  Per node i konsern-treet: `{innovasjon_norge: N, skattefunn: N, andre: N, avslag: N, under_behandling: N, total_belop_nok: NOK}`.
- **`konsern_aggregat`** — summen for **hele konsernet** (kun på rot-noden, basert på alle selskapene i treet).

Operasjonene:

- **Get konsernstøtte** *(v0.3)* — tre-struktur av konsernet med `selskap_stotte` per node + `konsern_aggregat` på roten. Slå på **«Flat ut treet»** for å få én n8n-item per selskap (rotnodens item inkluderer fortsatt `konsern_aggregat`) — lettere å mate inn i Sheets-, CSV- eller Loop-steg.
- **Get konsernstøtte-historikk** *(v0.3)* — flat liste over enkelt-tildelinger med kilde-filter (Innovasjon Norge / SkatteFUNN / Andre) og pagination.
- **Get skattelister (selskap)** *(v0.3)* — inntekt, formue og skatt per skatteår. **Krever full tilgang** og audit-logges per oppslag.

---

## Eksempel-arbeidsflyter

Repoet inneholder ferdige arbeidsflyt-JSON-er du kan importere direkte i n8n via **Workflows → Import from File**:

| Arbeidsflyt | Bruksområde |
|---|---|
| [`workflows/kyc-onboarding.json`](workflows/kyc-onboarding.json) | Webhook fra CRM → orgnr → AML/PEP + risikoscore + eierstruktur → Slack-varsel hvis risiko-nivå er **høy** eller **kritisk** |
| [`workflows/due-diligence-rapport.json`](workflows/due-diligence-rapport.json) | Manuell trigger → bygg konsernhierarki → loop over hver node → finansrollup + AML + konsernstøtte → samle i Google Sheets |
| [`workflows/nace-overvakning.json`](workflows/nace-overvakning.json) | Daglig schedule → liste i NACE-kode → loop → siste endringer → filtrer på relevans → e-post-digest |

---

## Priser

n8n-noden er gratis. Du betaler kun for Firmaradar-abonnementet ditt etter forbruk:

- **99 kr/mnd plattformavgift**
- Per-kall-pris avhengig av pakke (se [firmaradar.no/prising](https://firmaradar.no/prising))
- Egen rabattert MCP/agent-pakke for høy-volum-arbeidsflyter

n8n-kall belastes som vanlige API-kall siden de skjer fra din egen n8n-instans, ikke fra en AI-agent.

---

## Forholdet til MCP-serveren

Denne pakken og [Firmaradar MCP-serveren](https://github.com/Tiwas/firmaradar-mcp) er to grensesnitt til samme datakilde:

| | n8n community node | MCP-server |
|---|---|---|
| **Bruksområde** | Strukturerte arbeidsflyter, scheduling, integrasjoner | AI-agenter (Claude, ChatGPT, Cursor) |
| **Installasjon** | n8n GUI eller `npm install` | OAuth-tilkobling eller stdio |
| **Auth** | API-nøkkel via n8n-legitimasjon | OAuth 2.0 eller API-nøkkel |
| **Datakilde** | Samme Firmaradar API | Samme Firmaradar API |

Begge bruker samme operasjons-skjema i bunn, så du kan migrere arbeidsflyter mellom dem uten datatap.

---

## Hvorfor åpen kildekode?

- **Transparens** — du kan lese hver node-implementasjon og se nøyaktig hva som sendes til Firmaradar.
- **Tillit gjennom gjennomgang** — Apache 2.0. Lås til en spesifikk versjon, kjør din egen SBOM-skanning, eller fork-en og kjør på din egen infrastruktur.
- **Bidrag velkommen** — vi tar imot pull requests som forbedrer skjemaer eller legger til kompatibilitets-lag for nye n8n-versjoner.

Backend (firmaradar.no) er proprietær fordi den eier dataflyten og lisensieringen mot Skatteetaten og Brønnøysund.

---

## Sikkerhet og GDPR

- API-nøkkel lagres i n8n's krypterte legitimasjon-store, aldri i klartekst i arbeidsflyt-JSON
- Loggføring per kall på Firmaradar-siden (kunde-id, nøkkel-id, endepunkt og status) — eksporteres via DSAR-rapport
- Person-data pseudonymiseres på serversiden; sikkerhetskopier kryptert og lagret eksternt
- Norsk lov og GDPR-tilpasset: behandlingsgrunnlag, samtykke, oppbevaringstid

Hele sikkerhets-policyen: [firmaradar.no/personvern](https://firmaradar.no/personvern)

---

## Støtte og spørsmål

- **Feil i denne n8n-pakken** → [GitHub Issues](https://github.com/Tiwas/firmaradar-n8n/issues)
- **Spørsmål om data eller priser** → [kontakt Firmaradar](https://firmaradar.no/kontakt)
- **Salg eller partnerskap** → lars@firmaradar.no

---

## Versjons-historikk

- **0.3.0** — Speiler MCP v0.3. 22 operasjoner totalt: legger til AML-score, risikoscoring, FIV-sjekk, skattelister, konsernstøtte (oversikt + historikk) på toppen av v0.2-grunnlaget. Bytter klient-header til `X-FR-Client: n8n`, slipper provenance-publisering via npm OIDC, og leverer ferdige workflow-eksempler for KYC-onboarding, due-diligence-rapport og NACE-overvåkning. (Initial offentlige release på npm.)
- **0.1.0** — Internt skjelett. Ikke publisert til npm. 17 operasjoner mot v0.2 — overskredet av 0.3.0.

Se [CHANGELOG.md](CHANGELOG.md) for full historikk per release.

---

<div align="center">

**Bygget av [Firmaradar AS](https://firmaradar.no)** — agentisk infrastruktur for norske selskapsdata.

[firmaradar.no](https://firmaradar.no) &nbsp;·&nbsp; [Prising](https://firmaradar.no/prising) &nbsp;·&nbsp; [Dokumentasjon](https://firmaradar.no/dokumentasjon) &nbsp;·&nbsp; [Personvern](https://firmaradar.no/personvern) &nbsp;·&nbsp; [MCP-server](https://github.com/Tiwas/firmaradar-mcp)

</div>
