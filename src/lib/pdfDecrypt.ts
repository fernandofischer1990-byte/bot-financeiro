/**
 * Leitura local de PDFs protegidos por senha. A senha nunca sai do navegador:
 * o PDF é aberto aqui e só o texto extraído segue para a IA.
 */
export type PasswordRequester = (wrongAttempt: boolean) => Promise<string | null>;

export class PdfPasswordCancelled extends Error {
  constructor() {
    super('Importação cancelada: a senha do PDF não foi informada.');
    this.name = 'PdfPasswordCancelled';
  }
}

export function isEncryptedPdf(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder('latin1').decode(new Uint8Array(buffer));
  return /\/Encrypt\b/.test(head);
}

export async function extractTextFromProtectedPdf(
  buffer: ArrayBuffer,
  requestPassword: PasswordRequester,
): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let wrong = false;
  // Tenta até o usuário acertar ou cancelar.
  for (;;) {
    const password = await requestPassword(wrong);
    if (password === null) throw new PdfPasswordCancelled();
    try {
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)), password }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let line = '';
        let lastY: number | null = null;
        const lines: string[] = [];
        for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
          if (typeof item.str !== 'string') continue;
          const y = item.transform?.[5] ?? 0;
          if (lastY !== null && Math.abs(y - lastY) > 2) {
            lines.push(line.trim());
            line = '';
          }
          line += item.str + ' ';
          lastY = y;
        }
        if (line.trim()) lines.push(line.trim());
        pages.push(lines.join('\n'));
      }
      await doc.cleanup?.();
      const text = pages.join('\n\n').trim();
      if (!text) throw new Error('O PDF foi aberto, mas não tem texto legível (pode ser uma imagem escaneada).');
      return text;
    } catch (err) {
      if ((err as { name?: string })?.name === 'PasswordException') {
        wrong = true;
        continue;
      }
      throw err;
    }
  }
}
