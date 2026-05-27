import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Firmaradar — Bransje og overvåkning
 *
 * Operasjoner: listInNace, getRecentChanges, searchAnnouncements,
 * compareCompanies. Brukes typisk i overvåknings-arbeidsflyter og
 * markedsanalyse.
 */
export class FirmaradarBransje implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — Bransje og overvåkning',
        name: 'firmaradarBransje',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'NACE-oppslag, endringssporing og kunngjøringssøk',
        defaults: { name: 'Firmaradar Bransje' },
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
                    { name: 'List selskaper i NACE', value: 'listInNace', action: 'Alle selskaper i bransjekode' },
                    { name: 'Hent siste endringer', value: 'getRecentChanges', action: 'Endringer siste N dager' },
                    { name: 'Søk i kunngjøringer', value: 'searchAnnouncements', action: 'Fritekst-søk i BRREG-kunngjøringer' },
                    { name: 'Sammenlikne selskaper', value: 'compareCompanies', action: 'Side-om-side-sammenlikning' },
                ],
                default: 'listInNace',
            },
            {
                displayName: 'NACE-kode',
                name: 'naceCode',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['listInNace'] } },
                description: '5-sifret NACE-kode (f.eks. 62.010).',
            },
            {
                displayName: 'Kommune-kode',
                name: 'kommune',
                type: 'string',
                default: '',
                placeholder: '0301',
                displayOptions: { show: { operation: ['listInNace'] } },
                description: 'Valgfritt: 4-sifret kommune-kode',
            },
            {
                displayName: 'Organisasjonsnummer',
                name: 'orgnr',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['getRecentChanges'] } },
            },
            {
                displayName: 'Antall dager tilbake',
                name: 'days',
                type: 'number',
                default: 30,
                displayOptions: { show: { operation: ['getRecentChanges'] } },
            },
            {
                displayName: 'Søketekst',
                name: 'query',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['searchAnnouncements'] } },
            },
            {
                displayName: 'Orgnr-liste (kommaseparert)',
                name: 'orgnrs',
                type: 'string',
                default: '',
                required: true,
                placeholder: '999999999, 888888888',
                displayOptions: { show: { operation: ['compareCompanies'] } },
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

            switch (operation) {
                case 'listInNace':
                    path = '/api/v1/nace/companies';
                    qs = {
                        nace: this.getNodeParameter('naceCode', i),
                        kommune: this.getNodeParameter('kommune', i) || undefined,
                    };
                    break;
                case 'getRecentChanges':
                    path = `/api/v1/company/${this.getNodeParameter('orgnr', i)}/changes`;
                    qs = { days: this.getNodeParameter('days', i) };
                    break;
                case 'searchAnnouncements':
                    path = '/api/v1/announcements/search';
                    qs = { q: this.getNodeParameter('query', i) };
                    break;
                case 'compareCompanies':
                    path = '/api/v1/companies/compare';
                    qs = { orgnrs: (this.getNodeParameter('orgnrs', i) as string).split(/,\s*/).join(',') };
                    break;
                default:
                    throw new Error(`Ukjent operasjon: ${operation}`);
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
