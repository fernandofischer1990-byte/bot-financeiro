/**
 * Schemas Zod das fronteiras HTTP das edge functions (M2).
 * Um único lugar define o contrato aceito de cada função.
 */
import { z } from "npm:zod@^4.4.3";

export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_MESSAGES = 50;
export const MAX_CONTEXT_SIZE = 20000;
export const MAX_BASE64_SIZE = 7_000_000; // ~5MB binário
export const MAX_TEXT_SIZE = 100_000;

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
  // deno-lint-ignore no-explicit-any
  context: z.any().optional() as z.ZodType<any>,
});

export const parseStatementSchema = z
  .object({
    pdfBase64: z.string().max(MAX_BASE64_SIZE).optional(),
    pdfText: z.string().max(MAX_TEXT_SIZE).optional(),
  })
  .refine((v) => Boolean(v.pdfBase64 || v.pdfText), {
    message: "Informe pdfBase64 ou pdfText",
    path: ["pdfBase64"],
  });

export const categorizeSchema = z.object({
  items: z
    .array(
      z.object({
        index: z.number().int().nonnegative().optional(),
        description: z.string().max(500).optional(),
        type: z.enum(["income", "expense"]).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
});

export { z };
