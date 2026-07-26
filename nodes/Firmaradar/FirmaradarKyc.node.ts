import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Firmaradar — KYC og AML
 *
 * Operasjoner:
 *   Single:  checkAmlPep (person-navn, DPA-headere), getRiskScore, checkFiv
 *   Batch:   checkFivBulk, getRiskScoreBulk (opptil 50 orgnr per kall)
 *   Async:   startAmlReport → getAmlReport (submit → poll)
 *   Utfaset: getAmlScore (2026-07-07) — backend svarer 202 + rapport_id
 *            (async rapport-flyt); bruk startAmlReport + getAmlReport.
 *
 * Brukes typisk i KYC-onboarding og portefølje-screening-arbeidsflyter
 * med varsling ved høy risiko. Batch-operasjonene screener hele lister
 * (leverandører, kredittportefølje) i ett kall; async AML-rapport unngår
 * klient-timeout for store eier-trær.
 */
export class FirmaradarKyc implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — KYC og AML',
        name: 'firmaradarKyc',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'AML/PEP-screening, risikoscoring, foretak-i-vanskeligheter og batch/async-mønstre',
        defaults: { name: 'Firmaradar KYC' },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [{ name: 'firmaradarApi', required: true }],
        properties: [
            {
                displayName: 'Operasjon',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Sjekk AML/PEP', value: 'checkAmlPep', action: 'Sanksjons- og PEP-screening av en person (navn)' },
                    { name: 'Hent AML-score (utfaset — starter async rapport)', value: 'getAmlScore', action: 'Start AML-rapport (202 + rapport-id, poll videre)' },
                    { name: 'Hent risikoscore', value: 'getRiskScore', action: 'Generell risiko-vurdering' },
                    { name: 'Sjekk foretak i vanskeligheter', value: 'checkFiv', action: 'FIV-status (a-e-regler)' },
                    { name: 'Bulk: foretak i vanskeligheter', value: 'checkFivBulk', action: 'FIV-screening av opptil 50 orgnr' },
                    { name: 'Bulk: risikoscore', value: 'getRiskScoreBulk', action: 'Risikoscore for opptil 50 orgnr' },
                    { name: 'Start AML-rapport (async)', value: 'startAmlReport', action: 'Start AML-rapport i bakgrunnen' },
                    { name: 'Hent AML-rapport (poll)', value: 'getAmlReport', action: 'Poll status/resultat for AML-rapport' },
                ],
                default: 'checkAmlPep',
            },
            {
                displayName: 'Organisasjonsnummer',
                name: 'orgnr',
                type: 'string',
                default: '',
                required: true,
                placeholder: '999999999',
                description: '9-sifret norsk organisasjonsnummer',
                displayOptions: {
                    show: {
                        operation: ['getAmlScore', 'getRiskScore', 'checkFiv', 'startAmlReport'],
                    },
                },
            },
            // ── checkAmlPep: person-screening (AmlCheckRequest) ────────
            {
                displayName: 'Navn',
                name: 'name',
                type: 'string',
                default: '',
                required: true,
                placeholder: 'Ola Nordmann',
                description: 'Fullt navn å screene mot sanksjons- og PEP-lister (2-200 tegn)',
                displayOptions: { show: { operation: ['checkAmlPep'] } },
            },
            {
                displayName: 'Fødselsår',
                name: 'birthYear',
                type: 'number',
                default: 0,
                description: 'Valgfritt fødselsår (1900-2100) for skarpere matching. 0 = utelat.',
                displayOptions: { show: { operation: ['checkAmlPep'] } },
            },
            {
                displayName: 'Kategori',
                name: 'kategori',
                type: 'options',
                options: [
                    { name: 'Begge (sanksjon + PEP)', value: 'both' },
                    { name: 'Kun PEP', value: 'pep' },
                    { name: 'Kun sanksjoner', value: 'sanksjon' },
                ],
                default: 'both',
                displayOptions: { show: { operation: ['checkAmlPep'] } },
            },
            {
                displayName: 'Minimum Match-Ratio',
                name: 'minMatchRatio',
                type: 'number',
                typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
                default: 0.85,
                description: 'Fuzzy-match-terskel mellom 0 og 1',
                displayOptions: { show: { operation: ['checkAmlPep'] } },
            },
            {
                displayName: 'Organisasjonsnumre (opptil 50)',
                name: 'orgnrs',
                type: 'string',
                default: '',
                required: true,
                placeholder: '999999999, 998877665, ...',
                description:
                    'Liste med 1-50 ni-sifrede organisasjonsnumre, adskilt med komma, mellomrom eller linjeskift. Hvert orgnr teller som én enhet mot kvoten.',
                displayOptions: {
                    show: {
                        operation: ['checkFivBulk', 'getRiskScoreBulk'],
                    },
                },
            },
            {
                displayName: 'Hopp over ferskhets-sjekk',
                name: 'skipFreshness',
                type: 'boolean',
                default: false,
                description:
                    'Whether to accept FIV-data selv om underliggende regnskaps-/BRREG-snapshot er eldre enn normalt ferskhets-vindu (retrospektiv screening)',
                displayOptions: {
                    show: {
                        operation: ['checkFivBulk'],
                    },
                },
            },
            {
                displayName: 'Rapport-ID',
                name: 'reportId',
                type: 'string',
                default: '',
                required: true,
                placeholder: '0123456789abcdef0123456789abcdef',
                description: 'Job-ID-en returnert av «Start AML-rapport (async)»',
                displayOptions: {
                    show: {
                        operation: ['getAmlReport'],
                    },
                },
            },
            {
                displayName: 'Formål med oppslaget',
                name: 'purpose',
                type: 'options',
                options: [
                    { name: 'KYC-onboarding (ny kunde)', value: 'kyc_onboarding' },
                    { name: 'KYC-revurdering (eksisterende)', value: 'kyc_review' },
                    { name: 'Risikoovervåkning', value: 'risk_monitoring' },
                    { name: 'Manuell forespørsel', value: 'manual' },
                ],
                default: 'kyc_onboarding',
                displayOptions: { show: { operation: ['checkAmlPep', 'getAmlScore', 'startAmlReport'] } },
                description: 'Sendes som DPA-formål (X-FR-Purpose) — brukes til revisjonsspor og rate-limiting',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const credentials = await this.getCredentials('firmaradarApi');
        const baseUrl = (credentials.baseUrl as string) || 'https://firmaradar.no';

        for (let i = 0; i < items.length; i++) {
            const operation = this.getNodeParameter('operation', i) as string;
            let response: unknown;

            switch (operation) {
                case 'checkAmlPep': {
                    // Kontrakten (AmlCheckRequest) er PERSON-screening på navn —
                    // ikke orgnr — og krever DPA-headerne (samme gate som
                    // startAmlReport). Purpose sendes som X-FR-Purpose.
                    const checkPurpose = this.getNodeParameter('purpose', i) as string;
                    const checkBody: IDataObject = {
                        name: this.getNodeParameter('name', i),
                    };
                    const birthYear = this.getNodeParameter('birthYear', i, 0) as number;
                    if (birthYear) {
                        checkBody.birth_year = birthYear;
                    }
                    const kategori = this.getNodeParameter('kategori', i, 'both') as string;
                    if (kategori) {
                        checkBody.kategori = kategori;
                    }
                    const minMatchRatio = this.getNodeParameter('minMatchRatio', i, 0) as number;
                    if (minMatchRatio) {
                        checkBody.min_match_ratio = minMatchRatio;
                    }
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/v1/aml/check`,
                        headers: {
                            'X-FR-Purpose': checkPurpose,
                            'X-FR-DPA-Confirmed': 'true',
                        },
                        body: checkBody,
                        json: true,
                    });
                    break;
                }

                case 'getAmlScore': {
                    // UTFASET synkron sti (2026-07-07): POST /api/v1/aml/score
                    // starter nå en asynkron AML-rapport og svarer 202 med
                    // rapport_id + poll_url (+ deprecated: true). Kjed videre
                    // med «Hent AML-rapport (poll)» til status er done/failed.
                    // Krever samme DPA-headere som startAmlReport.
                    const scorePurpose = this.getNodeParameter('purpose', i) as string;
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/v1/aml/score`,
                        headers: {
                            'X-FR-Purpose': scorePurpose,
                            'X-FR-DPA-Confirmed': 'true',
                        },
                        body: {
                            orgnr: this.getNodeParameter('orgnr', i),
                            purpose: scorePurpose,
                        },
                        json: true,
                    });
                    break;
                }

                case 'getRiskScore':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'GET',
                        url: `${baseUrl}/api/v1/risikoscoring/score/${this.getNodeParameter('orgnr', i)}`,
                        json: true,
                    });
                    break;

                case 'checkFiv':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'GET',
                        url: `${baseUrl}/api/v1/fiv/assess/${this.getNodeParameter('orgnr', i)}`,
                        json: true,
                    });
                    break;

                case 'checkFivBulk':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/v1/fiv/bulk`,
                        body: {
                            orgnrs: parseOrgnrs(this.getNodeParameter('orgnrs', i) as string),
                            skip_freshness: this.getNodeParameter('skipFreshness', i) as boolean,
                        },
                        json: true,
                    });
                    break;

                case 'getRiskScoreBulk':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/v1/risikoscoring/score/bulk`,
                        body: {
                            orgnrs: parseOrgnrs(this.getNodeParameter('orgnrs', i) as string),
                        },
                        json: true,
                    });
                    break;

                case 'startAmlReport': {
                    // Async AML-rapport: submit → returnerer rapport_id + status
                    // «pending» (HTTP 202). Poll med «Hent AML-rapport (poll)».
                    // AML krever signert DPA + per-call-bekreftelse via headers.
                    const purpose = this.getNodeParameter('purpose', i) as string;
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/v1/aml/report`,
                        headers: {
                            'X-FR-Purpose': purpose,
                            'X-FR-DPA-Confirmed': 'true',
                        },
                        body: {
                            orgnr: this.getNodeParameter('orgnr', i),
                            purpose,
                        },
                        json: true,
                    });
                    break;
                }

                case 'getAmlReport':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'GET',
                        url: `${baseUrl}/api/v1/aml/report/${this.getNodeParameter('reportId', i)}`,
                        json: true,
                    });
                    break;

                default:
                    throw new Error(`Ukjent operasjon: ${operation}`);
            }

            returnData.push({ json: response as IDataObject });
        }
        return [returnData];
    }
}

/**
 * Del opp en fri-tekst-liste med organisasjonsnumre til et array.
 *
 * Aksepterer komma, mellomrom, linjeskift, semikolon og tab som skilletegn.
 * Tomme elementer fjernes. Backend håndhever 1-50-grensen og orgnr-formatet
 * og returnerer per-orgnr-feil, så vi sender listen videre uten å avvise her.
 */
function parseOrgnrs(raw: string): string[] {
    return (raw || '')
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
