import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeConnectionType,
} from 'n8n-workflow';

/**
 * Firmaradar — Offentlige data
 *
 * Operasjoner: getKonsernstotte, getSkattelister.
 * Tilgangskrav varierer per operasjon (skattelister krever
 * full_ownership).
 */
export class FirmaradarOffentlig implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — Offentlige data',
        name: 'firmaradarOffentlig',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Konsernstøtte (NAV/koronastøtte) og skattelister (inntekt/formue/skatt)',
        defaults: { name: 'Firmaradar Offentlige data' },
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
                    { name: 'Hent konsernstøtte', value: 'getKonsernstotte', action: 'NAV-tildelinger og koronastøtte' },
                    { name: 'Hent konsernstøtte-historikk', value: 'getKonsernstotteHistorikk', action: 'Flat liste med filter og pagination' },
                    { name: 'Hent skattelister (selskap)', value: 'getSkattelisterSelskap', action: 'Inntekt, formue, skatt — krever full tilgang' },
                ],
                default: 'getKonsernstotte',
            },
            {
                displayName: 'Organisasjonsnummer',
                name: 'orgnr',
                type: 'string',
                default: '',
                required: true,
                placeholder: '999999999',
            },
            {
                displayName: 'Kilde-filter',
                name: 'kilde',
                type: 'options',
                options: [
                    { name: 'Alle', value: '' },
                    { name: 'Innovasjon Norge', value: 'innovasjon_norge' },
                    { name: 'SkatteFUNN', value: 'skattefunn' },
                    { name: 'Andre', value: 'andre' },
                ],
                default: '',
                displayOptions: { show: { operation: ['getKonsernstotteHistorikk'] } },
            },
            {
                displayName: 'Skatteår',
                name: 'ar',
                type: 'number',
                default: 0,
                displayOptions: { show: { operation: ['getSkattelisterSelskap'] } },
                description: 'Valgfritt: filtrer på ett spesifikt skatteår (0 = alle år)',
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
            const orgnr = this.getNodeParameter('orgnr', i) as string;
            let path: string;
            let qs: Record<string, unknown> = {};

            switch (operation) {
                case 'getKonsernstotte':
                    path = `/ext/konsern_stotte/oversikt/${orgnr}`;
                    break;
                case 'getKonsernstotteHistorikk':
                    path = `/ext/konsern_stotte/historikk/${orgnr}`;
                    qs = { kilde: this.getNodeParameter('kilde', i) || undefined };
                    break;
                case 'getSkattelisterSelskap':
                    path = `/ext/skattelister/selskap/${orgnr}`;
                    const ar = this.getNodeParameter('ar', i) as number;
                    if (ar > 0) qs = { ar };
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
            returnData.push({ json: response });
        }
        return [returnData];
    }
}
