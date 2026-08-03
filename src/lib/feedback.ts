import { friendlyImportError } from '@/lib/importErrors';

/**
 * Camada única de mensagens ao usuário (PT-BR).
 * Objetivo: nenhum erro técnico cru (RLS, PostgREST, rede) chega à interface.
 */

/** Traduz qualquer erro (string ou Error) em uma mensagem acionável em PT-BR. */
export function translateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const m = raw.toLowerCase();

  if (!raw) return 'Algo não saiu como esperado. Tente novamente.';

  // Conectividade
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  if (m.includes('aborted') || m.includes('timeout') || m.includes('timed out')) {
    return 'A operação demorou demais e foi interrompida. Tente novamente.';
  }

  // Autenticação e permissão
  if (m.includes('jwt') || m.includes('invalid refresh token') || m.includes('not authenticated')) {
    return 'Sua sessão expirou. Entre novamente para continuar.';
  }
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('violates row')) {
    return 'Você não tem permissão para essa operação neste registro.';
  }

  // Integridade de dados
  if (m.includes('duplicate key') || m.includes('already exists')) {
    return 'Esse registro já existe. Verifique os dados e tente novamente.';
  }
  if (m.includes('violates check constraint') || m.includes('invalid input syntax') || m.includes('numeric')) {
    return 'Algum campo está com formato inválido. Revise os valores informados.';
  }
  if (m.includes('not null')) {
    return 'Um campo obrigatório não foi preenchido.';
  }

  // Limites
  if (m.includes('rate limit') || m.includes('429') || m.includes('too many requests')) {
    return 'Muitas solicitações em pouco tempo. Aguarde alguns segundos e tente de novo.';
  }
  if (m.includes('payload') || m.includes('too large')) {
    return 'O conteúdo enviado é muito grande. Reduza o arquivo ou divida em partes.';
  }

  // Leitura de arquivos reaproveita o tradutor de importação já existente
  if (
    m.includes('encryption') || m.includes('encrypted') || m.includes('password') ||
    m.includes('zip') || m.includes('corrupt') || m.includes('unsupported file')
  ) {
    return friendlyImportError(error);
  }

  return raw;
}

/** Catálogo padronizado de mensagens de sucesso/alerta/erro. */
export const MESSAGES = {
  transaction: {
    created: 'Transação registrada',
    updated: 'Transação atualizada',
    deleted: 'Transação excluída',
    createFailed: 'Não foi possível registrar a transação',
    updateFailed: 'Não foi possível atualizar a transação',
    deleteFailed: 'Não foi possível excluir a transação',
    loadFailed: 'Não foi possível carregar suas transações',
    none: 'Nenhuma transação encontrada',
  },
  investment: {
    created: 'Investimento cadastrado',
    updated: 'Investimento atualizado',
    deleted: 'Investimento excluído',
    createFailed: 'Não foi possível salvar o investimento',
    updateFailed: 'Não foi possível atualizar o investimento',
    deleteFailed: 'Não foi possível excluir o investimento',
    loadFailed: 'Não foi possível carregar seus investimentos',
  },
  import: {
    done: 'Importação concluída',
    failed: 'Não foi possível concluir a importação',
    readFailed: 'Não foi possível ler o arquivo',
  },
  chat: {
    failed: 'Não foi possível falar com o assistente agora',
  },
  export: {
    done: 'Arquivo exportado',
    empty: 'Nada para exportar',
  },
  generic: {
    unexpected: 'Algo não saiu como esperado. Tente novamente.',
    saved: 'Alterações salvas',
  },
} as const;
