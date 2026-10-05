/**
 * Leitor único de planilhas (M10). Todo CSV/XLS/XLSX/ODS/TSV do app passa por aqui,
 * para que proteção por senha, aba escolhida e conversão de datas sejam iguais em todo lugar.
 */
import { read, utils } from '@e965/xlsx';

export const SPREADSHEET_EXTENSIONS = ['csv', 'xls', 'xlsx', 'ods', 'tsv'] as const;

export interface ReadSpreadsheetOptions {
  /** Converte células de data em objetos Date. */
  cellDates?: boolean;
  /** Usa a aba com mais linhas em vez da primeira. */
  pickLargestSheet?: boolean;
  /** Preenche células vazias com null (mantém todas as colunas em cada linha). */
  fillEmptyWithNull?: boolean;
}

export interface SpreadsheetResult {
  rows: Record<string, unknown>[];
  sheetName: string;
}

export async function readSpreadsheet(
  file: File,
  { cellDates = false, pickLargestSheet = false, fillEmptyWithNull = false }: ReadSpreadsheetOptions = {},
): Promise<SpreadsheetResult> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { cellDates });
  const toRows = (name: string) =>
    utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[name],
      fillEmptyWithNull ? { defval: null } : undefined,
    );

  let sheetName = workbook.SheetNames[0];
  let rows = sheetName ? toRows(sheetName) : [];

  if (pickLargestSheet) {
    for (const name of workbook.SheetNames.slice(1)) {
      const candidate = toRows(name);
      if (candidate.length > rows.length) {
        rows = candidate;
        sheetName = name;
      }
    }
  }

  return { rows, sheetName };
}
