import {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Firmaradar — Offentlige data
 *
 * Operasjoner: getKonsernstotte, getKonsernstotteHistorikk, getSkattelisterSelskap.
 * Tilgangskrav varierer per operasjon (skattelister krever
 * full_ownership).
 *
 * Konsernstøtte-respons (post #134, 2026-05-27):
 *   Tre-struktur av selskaper i konsernet. Per node finnes ``selskap_stotte``
 *   (NAV/Innovasjon Norge/SkatteFUNN-tildelinger til *det enkelte* selskapet),
 *   pluss ``konsern_aggregat`` på rot-noden (summen av all støtte for hele
 *   konsernet — antall per kilde + total NOK).
 *
 *   Sett ``flatten=true`` for å returnere én rad per node i treet i stedet
 *   for hele tre-strukturen (lettere å mate inn i Sheets/CSV-aktige steg).
 */
export class FirmaradarOffentlig implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — Offentlige data',
        name: 'firmaradarOffentlig',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Konsernstøtte (selskap_stotte + konsern_aggregat) og skattelister (inntekt/formue/skatt)',
        defaults: { name: 'Firmaradar Offentlige data' },
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
                    {
                        name: 'Hent konsernstøtte',
                        value: 'getKonsernstotte',
                        action: 'Tre med selskap_stotte per node + konsern_aggregat på rot',
                    },
                    {
                        name: 'Hent konsernstøtte-historikk',
                        value: 'getKonsernstotteHistorikk',
                        action: 'Flat liste over enkelt-tildelinger med filter og pagination',
                    },
                    {
                        name: 'Hent skattelister (selskap)',
                        value: 'getSkattelisterSelskap',
                        action: 'Inntekt, formue, skatt — krever full tilgang',
                    },
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
                displayName: 'Flat ut treet',
                name: 'flatten',
                type: 'boolean',
                default: false,
                displayOptions: { show: { operation: ['getKonsernstotte'] } },
                description:
                    'Whether to return one n8n item per node in the consortium tree (with selskap_stotte). The root node carries konsern_aggregat. If off, the full tree-structure is returned as one item.',
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
            let qs: IDataObject = {};

            switch (operation) {
                case 'getKonsernstotte':
                    path = `/api/v1/konsernstotte/oversikt/${orgnr}`;
                    break;
                case 'getKonsernstotteHistorikk':
                    path = `/api/v1/konsernstotte/historikk/${orgnr}`;
                    qs = { kilde: this.getNodeParameter('kilde', i) || undefined };
                    break;
                case 'getSkattelisterSelskap':
                    path = `/api/v1/skattelister/selskap/${orgnr}`;
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

            // Valgfri flatten for getKonsernstotte: gå gjennom treet og emit
            // én rad per node. Selve API-responsen returnerer fortsatt nøklene
            // `selskap_stotte` (per node) og `konsern_aggregat` (på rot-noden).
            if (operation === 'getKonsernstotte' && this.getNodeParameter('flatten', i, false) === true) {
                const flat = flattenKonsernTree(response as Record<string, unknown>);
                for (const row of flat) {
                    returnData.push({ json: row as IDataObject });
                }
                continue;
            }

            returnData.push({ json: response as IDataObject });
        }
        return [returnData];
    }
}

/**
 * Flat ut konsernstøtte-treet til én rad per node.
 *
 * Forventet input-struktur (post #134):
 *   {
 *     orgnr, navn, ...,
 *     selskap_stotte: { innovasjon_norge: N, skattefunn: N, ..., total_belop_nok: NOK },
 *     konsern_aggregat: { innovasjon_norge: N, ..., total_belop_nok: NOK },  // kun rot
 *     children: [ { ... rekursivt ... } ]
 *   }
 *
 * Eldre `stotte`-nøkkel beholdes som fallback for bakoverkompatibilitet.
 */
function flattenKonsernTree(payload: Record<string, unknown>): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [];

    const root = (payload?.root as Record<string, unknown> | undefined) ?? payload;
    const konsernAggregat =
        (payload?.konsern_aggregat as Record<string, unknown> | undefined) ??
        (root?.konsern_aggregat as Record<string, unknown> | undefined);

    function walk(node: Record<string, unknown> | undefined, depth: number, isRoot: boolean): void {
        if (!node || typeof node !== 'object') return;
        const selskapStotte =
            (node.selskap_stotte as Record<string, unknown> | undefined) ??
            (node.stotte as Record<string, unknown> | undefined) ??
            {};
        const row: Record<string, unknown> = {
            depth,
            is_root: isRoot,
            orgnr: node.orgnr,
            navn: node.navn ?? node.name,
            selskap_stotte: selskapStotte,
        };
        if (isRoot && konsernAggregat) {
            row.konsern_aggregat = konsernAggregat;
        }
        rows.push(row);

        const children = node.children as Record<string, unknown>[] | undefined;
        if (Array.isArray(children)) {
            for (const child of children) {
                walk(child, depth + 1, false);
            }
        }
    }

    walk(root as Record<string, unknown>, 0, true);
    return rows;
}
