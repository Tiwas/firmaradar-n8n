import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeConnectionType,
} from 'n8n-workflow';

/**
 * Firmaradar — Person
 *
 * Operasjoner: search, get, getCompanies, getRoles.
 * Krever full_ownership-tilgang siden person-data er sensitivt.
 */
export class FirmaradarPerson implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — Person',
        name: 'firmaradarPerson',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Slå opp norske personer, deres roller og eierskap',
        defaults: { name: 'Firmaradar Person' },
        inputs: [NodeConnectionType.Main],
        outputs: [NodeConnectionType.Main],
        credentials: [{ name: 'firmaradarApi', required: true }],
        properties: [
            {
                displayName: 'Operasjon',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Søk personer', value: 'search', action: 'Navne-søk med skrivefeil-toleranse' },
                    { name: 'Hent person', value: 'get', action: 'Hent person-profil' },
                    { name: 'Hent selskaper', value: 'getCompanies', action: 'Hent selskaper personen eier eller har rolle i' },
                    { name: 'Hent roller', value: 'getRoles', action: 'Hent aktive og historiske roller' },
                ],
                default: 'search',
            },
            {
                displayName: 'Navn',
                name: 'name',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['search'] } },
                description: 'Personens navn (full-tekst, fuzzy matching)',
            },
            {
                displayName: 'Person-ID',
                name: 'personId',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['get', 'getCompanies', 'getRoles'] } },
                description: 'Person-ID fra et søk eller eierskap-oppslag',
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
            let qs: Record<string, unknown> = {};

            if (operation === 'search') {
                path = '/api/v1/search/persons';
                qs = { q: this.getNodeParameter('name', i) };
            } else {
                const personId = this.getNodeParameter('personId', i) as string;
                switch (operation) {
                    case 'get':
                        path = `/api/v1/person/${personId}`;
                        break;
                    case 'getCompanies':
                        path = `/api/v1/person/${personId}/companies`;
                        break;
                    case 'getRoles':
                        path = `/api/v1/person/${personId}/roles`;
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
            returnData.push({ json: response });
        }
        return [returnData];
    }
}
