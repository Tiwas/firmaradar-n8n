import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Firmaradar — Person
 *
 * Operasjoner: search, getCompanies, getRoles.
 * Krever full_ownership-tilgang siden person-data er sensitivt.
 *
 * v0.7.0: rettet til kanoniske API-paths. «Hent person» er fjernet —
 * operasjonen pekte på en rute som aldri har eksistert i backend
 * (person-profilen er klient-side-orkestrering i MCP-serveren). Bruk
 * «Søk personer» + «Hent roller»/«Hent selskaper» i stedet. Merk at
 * rolle-oppslag og eierskaps-oppslag bruker HVER SIN nøkkel fra
 * søkeresultatet (role_persons[].id vs shareholders[].id).
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
                    { name: 'Søk personer', value: 'search', action: 'Navne-søk med skrivefeil-toleranse' },
                    { name: 'Hent roller', value: 'getRoles', action: 'Hent aktive og historiske roller' },
                    { name: 'Hent selskaper', value: 'getCompanies', action: 'Hent selskaper personen eier aksjer i' },
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
                displayName: 'Rolle-person-ID',
                name: 'rolePersonId',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['getRoles'] } },
                description: 'Stabil rolle-person-nøkkel fra «Søk personer»-svarets role_persons-liste',
            },
            {
                displayName: 'Eier-person-nøkkel',
                name: 'ownerPersonKey',
                type: 'string',
                default: '',
                required: true,
                displayOptions: { show: { operation: ['getCompanies'] } },
                description: 'Stabil eier-person-nøkkel fra «Søk personer»-svarets shareholders-liste',
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
                case 'search':
                    path = '/api/v1/person/search';
                    qs = { q: this.getNodeParameter('name', i) };
                    break;
                case 'getRoles':
                    path = `/api/v1/person/roles/${encodeURIComponent(
                        this.getNodeParameter('rolePersonId', i) as string,
                    )}`;
                    break;
                case 'getCompanies':
                    path = `/api/v1/person/shareholdings/${encodeURIComponent(
                        this.getNodeParameter('ownerPersonKey', i) as string,
                    )}`;
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
