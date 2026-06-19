import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Firmaradar — Selskap
 *
 * Operasjoner for selskaps-oppslag:
 *   - search        — søk på navn eller orgnr
 *   - get           — full profil
 *   - getOwnership  — konsernhierarki opp og ned
 *   - getRoles      — styre, daglig leder, prokura
 *   - getFinancials — årsregnskap og nøkkeltall
 *   - getAnnouncements — BRREG-kunngjøringer
 *   - getSignals    — risiko- og KYC-flagg
 *   - findRelated   — relaterte via eier, rolle eller adresse
 *
 * Hver operasjon mapper 1-til-1 til en MCP-tool i firmaradar-mcp-pakken.
 * Samme skjema på input + output, slik at arbeidsflyter kan migreres
 * mellom n8n og MCP uten datatap.
 */
export class FirmaradarCompany implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — Selskap',
        name: 'firmaradarCompany',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Slå opp norske selskaper, eierstrukturer, konsern, roller og regnskap',
        defaults: {
            name: 'Firmaradar Selskap',
        },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [
            {
                name: 'firmaradarApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Operasjon',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Søk selskaper', value: 'search', action: 'Søk på navn eller orgnr' },
                    { name: 'Hent selskap', value: 'get', action: 'Hent full selskapsprofil' },
                    { name: 'Hent eierskap', value: 'getOwnership', action: 'Hent konsernhierarki opp og ned' },
                    { name: 'Hent roller', value: 'getRoles', action: 'Hent styre, daglig leder, prokura' },
                    { name: 'Hent regnskap', value: 'getFinancials', action: 'Hent årsregnskap og nøkkeltall' },
                    { name: 'Hent kunngjøringer', value: 'getAnnouncements', action: 'Hent BRREG-kunngjøringer' },
                    { name: 'Hent signaler', value: 'getSignals', action: 'Hent risiko- og KYC-flagg' },
                    { name: 'Finn relaterte', value: 'findRelated', action: 'Finn relaterte selskaper' },
                ],
                default: 'search',
            },

            // ── Søk ────────────────────────────────────────────────────
            {
                displayName: 'Søketekst',
                name: 'query',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['search'] } },
                description: 'Selskapsnavn eller orgnr (9 sifre)',
            },
            {
                displayName: 'Maks antall treff',
                name: 'limit',
                type: 'number',
                typeOptions: {
                    minValue: 1,
                },
                description: 'Max number of results to return',
                default: 50,
                displayOptions: { show: { operation: ['search'] } },
            },

            // ── Felles orgnr-parameter (resten av operasjonene) ────────
            {
                displayName: 'Organisasjonsnummer',
                name: 'orgnr',
                type: 'string',
                default: '',
                required: true,
                placeholder: '999999999',
                displayOptions: {
                    show: {
                        operation: [
                            'get',
                            'getOwnership',
                            'getRoles',
                            'getFinancials',
                            'getAnnouncements',
                            'getSignals',
                            'findRelated',
                        ],
                    },
                },
                description: '9-sifret norsk organisasjonsnummer',
            },

            // ── Hent selskap: valgfrie tilleggsfelt (fields) ───────────
            {
                displayName: 'Inkluder tilleggsfelt',
                name: 'fields',
                type: 'multiOptions',
                options: [
                    { name: 'Konsernstruktur', value: 'group' },
                    { name: 'Eiere', value: 'owners' },
                    { name: 'Eiere (virksomhet)', value: 'business_owners' },
                    { name: 'Eiere (alle, inkl. personer)', value: 'full_owners' },
                    { name: 'Offentlig støtte', value: 'grants' },
                    { name: 'BRREG-tildelinger', value: 'brreg_grants' },
                    { name: 'Immaterielle rettigheter (Patentstyret)', value: 'ip' },
                    { name: 'Nylige endringer', value: 'changes' },
                    { name: 'Nøkkeltall (regnskap)', value: 'financial_metrics' },
                ],
                default: [],
                displayOptions: { show: { operation: ['get'] } },
                description: 'Ekstra seksjoner å berike profilen med. «Immaterielle rettigheter» henter patenter, varemerker og design fra Patentstyret.',
            },

            // ── Eierskap-spesifikke parametre ──────────────────────────
            {
                displayName: 'Retning',
                name: 'direction',
                type: 'options',
                options: [
                    { name: 'Begge', value: 'both' },
                    { name: 'Opp (eiere)', value: 'up' },
                    { name: 'Ned (datterselskaper)', value: 'down' },
                ],
                default: 'both',
                displayOptions: { show: { operation: ['getOwnership'] } },
            },
            {
                displayName: 'Dybde',
                name: 'depth',
                type: 'number',
                default: 5,
                displayOptions: { show: { operation: ['getOwnership'] } },
                description: 'Antall nivåer å gå opp eller ned',
            },
            {
                displayName: 'Inkluder personer',
                name: 'includePersons',
                type: 'boolean',
                default: false,
                displayOptions: { show: { operation: ['getOwnership'] } },
                description: 'Vis person-eiere (krever full_ownership-tilgang)',
            },

            // ── Roller-spesifikke ──────────────────────────────────────
            {
                displayName: 'Rolle-type',
                name: 'roleType',
                type: 'options',
                options: [
                    { name: 'Alle', value: 'all' },
                    { name: 'Styre', value: 'board' },
                    { name: 'Daglig leder', value: 'managing_director' },
                    { name: 'Prokura', value: 'proxy' },
                ],
                default: 'all',
                displayOptions: { show: { operation: ['getRoles'] } },
            },
            {
                displayName: 'Inkluder fratrådte',
                name: 'includeRetired',
                type: 'boolean',
                default: false,
                displayOptions: { show: { operation: ['getRoles'] } },
            },

            // ── Regnskap-spesifikke ────────────────────────────────────
            {
                displayName: 'Antall år tilbake',
                name: 'years',
                type: 'number',
                default: 3,
                displayOptions: { show: { operation: ['getFinancials'] } },
            },

            // ── Find related ───────────────────────────────────────────
            {
                displayName: 'Relasjons-type',
                name: 'via',
                type: 'options',
                options: [
                    { name: 'Felles eier', value: 'shared_owner' },
                    { name: 'Felles rolle (person)', value: 'shared_role_person' },
                    { name: 'Samme adresse', value: 'same_address' },
                ],
                default: 'shared_owner',
                displayOptions: { show: { operation: ['findRelated'] } },
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

            let path: string;
            let qs: IDataObject = {};

            if (operation === 'search') {
                const query = this.getNodeParameter('query', i) as string;
                const limit = this.getNodeParameter('limit', i) as number;
                path = '/api/v1/search/companies';
                qs = { q: query, limit };
            } else {
                const orgnr = this.getNodeParameter('orgnr', i) as string;
                switch (operation) {
                    case 'get': {
                        path = `/api/v1/company/${orgnr}`;
                        const fields = this.getNodeParameter('fields', i, []) as string[];
                        if (fields.length) {
                            qs = { fields: fields.join(',') };
                        }
                        break;
                    }
                    case 'getOwnership':
                        path = `/api/v1/company/${orgnr}/ownership`;
                        qs = {
                            direction: this.getNodeParameter('direction', i),
                            depth: this.getNodeParameter('depth', i),
                            include_persons: this.getNodeParameter('includePersons', i) ? 1 : 0,
                        };
                        break;
                    case 'getRoles':
                        path = `/api/v1/company/${orgnr}/roles`;
                        qs = {
                            role_type: this.getNodeParameter('roleType', i),
                            include_retired: this.getNodeParameter('includeRetired', i) ? 1 : 0,
                        };
                        break;
                    case 'getFinancials':
                        path = `/api/v1/company/${orgnr}/financials`;
                        qs = { years: this.getNodeParameter('years', i) };
                        break;
                    case 'getAnnouncements':
                        path = `/api/v1/company/${orgnr}/announcements`;
                        break;
                    case 'getSignals':
                        path = `/api/v1/company/${orgnr}/signals`;
                        break;
                    case 'findRelated':
                        path = `/api/v1/company/${orgnr}/related`;
                        qs = { via: this.getNodeParameter('via', i) };
                        break;
                    default:
                        throw new Error(`Ukjent operasjon: ${operation}`);
                }
            }

            const response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                method: 'GET',
                url: `${baseUrl}${path}`,
                qs,
                json: true,
            });

            returnData.push({ json: response as IDataObject });
        }

        return [returnData];
    }
}
