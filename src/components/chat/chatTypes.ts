import type { Action } from '@/lib/actionParser';

export type AddTxPayload = Extract<Action, { type: 'add_transaction' }>['payload'];
export type ClarificationPayload = Extract<Action, { type: 'request_clarification' }>['payload'];

export type FiscalKind = 'transaction' | 'investment';

export interface PendingFiscalField {
  key: string;
  label: string;
  current: string | null;
  next?: string;
}

export interface PendingFiscal {
  kind: FiscalKind;
  id: string;
  label: string;
  payload: Record<string, string | number | undefined>;
  fields: PendingFiscalField[];
}

export interface PendingAdd {
  original: AddTxPayload;
  edited: AddTxPayload;
  isDuplicate: boolean;
}
