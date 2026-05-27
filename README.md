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

17 operasjoner, organisert i fem node-typer for å holde n8n-paletten ryddig:

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
- **Get konsernstøtte** *(v0.3)* — NAV-tildelinger, koronastøtte og andre offentlige tilskudd
- **Get skattelister** *(v0.3)* — inntekt/formue/skatt (krever full tilgang)

---

## Eksempel-arbeidsflyter

Repoet inneholder ferdige arbeidsflyt-JSON-er du kan importere direkte i n8n via **Workflows → Import from File**:

| Arbeidsflyt | Bruksområde |
|---|---|
| [`workflows/kyc-onboarding.json`](workflows/kyc-onboarding.json) | Ny kunde registrerer seg i CRM → automatisk AML/PEP + eierstruktur + risikoscore → varsler compliance-team via Slack hvis høy risiko |
| [`workflows/konkurs-overvakning.json`](workflows/konkurs-overvakning.json) | Daglig sjekk av selskaper i kundeporteføljen → varsel ved konkurssignal eller foretak-i-vanskeligheter |
| [`workflows/konsern-due-diligence.json`](workflows/konsern-due-diligence.json) | Gitt orgnr → bygg konsernhierarki + finansiell rollup + AML på alle nivåer → eksporter PDF |

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

- **0.1.0** — Initial public release. 17 operasjoner som speiler MCP v0.2.
- **0.3.0** *(planlagt)* — Legger til 5 nye operasjoner: AML-score, risikoscoring, FIV-sjekk, skattelister, konsernstøtte.

---

<div align="center">

**Bygget av [Firmaradar AS](https://firmaradar.no)** — agentisk infrastruktur for norske selskapsdata.

[firmaradar.no](https://firmaradar.no) &nbsp;·&nbsp; [Prising](https://firmaradar.no/prising) &nbsp;·&nbsp; [Dokumentasjon](https://firmaradar.no/dokumentasjon) &nbsp;·&nbsp; [Personvern](https://firmaradar.no/personvern) &nbsp;·&nbsp; [MCP-server](https://github.com/Tiwas/firmaradar-mcp)

</div>
