/**
 * Traduz erros técnicos de leitura de arquivos em mensagens acionáveis em PT-BR.
 */
export function friendlyImportError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const m = msg.toLowerCase();

  // Arquivo protegido por senha ou por rótulo de confidencialidade (IRM/DRM)
  if (
    m.includes('encryptioninfo') ||
    m.includes('encrypted') ||
    m.includes('password') ||
    m.includes('senha')
  ) {
    return 'Este arquivo está protegido/criptografado (senha ou rótulo de confidencialidade do Excel). Abra-o no Excel, use "Arquivo > Informações > Proteger Pasta de Trabalho" para remover a proteção (ou "Salvar como" em .xlsx / .csv sem senha) e importe novamente.';
  }

  if (m.includes('unsupported file') || m.includes('cannot find file') || m.includes('corrupt')) {
    return 'Não foi possível ler o arquivo. Ele pode estar corrompido ou não ser realmente uma planilha. Tente exportar novamente em .xlsx ou .csv.';
  }

  if (m.includes('zip') || m.includes('end of central directory')) {
    return 'O arquivo parece incompleto ou não é uma planilha válida. Baixe-o novamente e tente de novo.';
  }

  return msg || 'Formato inválido';
}
