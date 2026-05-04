# Corrigir erro de validação no chat ("Propriedades perigosas detectadas")

## Causa raiz

Toda mensagem enviada ao chat exibe o toast **"Erro de validação — O assistente tentou executar uma ação inválida"**.

Os logs revelam o motivo:

```
CHAT_ACTION_ERROR {
  rawResponse: '{ "message": "...", "action": null }',
  error: "Propriedades perigosas detectadas"
}
```

A resposta do modelo é válida (texto + `action: null`), mas o parser em `src/lib/actionParser.ts` rejeita o objeto na checagem anti-prototype-pollution:

```ts
if ('__proto__' in rawParsed || 'constructor' in rawParsed || 'prototype' in rawParsed) {
  return { success: false, error: 'Propriedades perigosas detectadas' };
}
```

O operador `in` percorre toda a cadeia de protótipos. **Todo objeto JavaScript herda `constructor` de `Object.prototype`**, então essa verificação retorna `true` para qualquer `{}`. Resultado: 100% das respostas são marcadas como inválidas.

Além disso, o modelo está retornando `"action": null`, e o schema Zod atual exige `action` como `optional()` (que aceita `undefined`, mas não `null`). Mesmo após corrigir a checagem, `null` ainda quebraria a validação Zod com outra mensagem de erro.

## Correção

### Arquivo: `src/lib/actionParser.ts`

1. **Trocar a checagem de prototype pollution** para usar `Object.prototype.hasOwnProperty.call(...)`, que só inspeciona chaves *próprias* do objeto (que é o ataque real do JSON.parse):

```ts
const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(rawParsed, key);
if (hasOwn('__proto__') || hasOwn('constructor') || hasOwn('prototype')) {
  return { success: false, error: 'Propriedades perigosas detectadas' };
}
```

2. **Aceitar `action: null`** no schema Zod, tratando-o como ausência de ação:

```ts
const AIResponseSchema = z.object({
  message: z.string(),
  action: ActionPayloadSchema.nullable().optional()
});
```

E logo após desestruturar, normalizar: `if (!rawAction) return { success: true, message };` (já existe, só precisa aceitar `null`).

## Verificação

Após o fix, enviar mensagens conversacionais (sem ação) ao chat não deve mais disparar o toast vermelho. Mensagens com ação real (`add_transaction`, `delete_transaction`) continuam funcionando normalmente.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/actionParser.ts` | Trocar `in` por `hasOwnProperty.call`; aceitar `action: null` no schema |

Sem mudanças em backend, edge functions, contexto ou UI.
