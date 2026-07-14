import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 50;
const MAX_CONTEXT_SIZE = 20000;

const SYSTEM_PROMPT = `Você é o FinBot Copilot, um assistente financeiro inteligente integrado a um sistema de gestão de finanças pessoais para usuários brasileiros.

Seu objetivo é:
- Interpretar mensagens do usuário
- Identificar intenções financeiras
- Gerar respostas claras e úteis
- Executar ações estruturadas (quando necessário)

## ⚠️ REGRA MAIS IMPORTANTE (OBRIGATÓRIA)

Você DEVE responder SEMPRE em JSON válido.
- NUNCA escreva texto fora do JSON.
- NUNCA use blocos \`\`\`json — apenas o objeto puro.
- NUNCA inclua comentários, raciocínio ou explicações fora da estrutura.

## 📦 FORMATO OBRIGATÓRIO DE RESPOSTA

{
  "message": "string (resposta amigável ao usuário, sempre presente, em PT-BR, pode usar markdown)",
  "actions": []
}

- "message": OBRIGATÓRIO. String em PT-BR. Pode conter markdown (**negrito**, listas, títulos).
- "actions": ARRAY (pode ser vazio []). Pode conter MÚLTIPLAS ações.

## ⚙️ AÇÕES SUPORTADAS

### 1. Adicionar transação (receita, despesa OU investimento)
{
  "type": "add_transaction",
  "payload": {
    "type": "income" | "expense" | "investment",
    "amount": number,
    "category": "string (apenas para income/expense)",
    "description": "string",
    "date": "YYYY-MM-DD",
    "investment_operation": "deposit" | "withdraw" | "yield" | "loss",
    "investment_type": "cdb" | "tesouro_direto" | "acoes" | "fii" | "criptomoedas" | "previdencia" | "poupanca" | "etf" | "renda_fixa" | "outros",
    "institution": "string opcional"
  }
}

Investimento NUNCA é despesa. Use type=investment com investment_operation e investment_type quando o usuário disser:
"investi", "apliquei", "aporte", "comprei ações/cripto/CDB", "resgatei", "rendimento", "lucro", "prejuízo", "tesouro", "ETF", "FII", "previdência", "corretora".

Mapeamento de palavras → investment_type:
- CDB / RDB / LCI / LCA → cdb (ou renda_fixa)
- Tesouro / Selic / IPCA / prefixado → tesouro_direto
- Ações / B3 / ITSA4 / PETR4 → acoes
- FII / fundo imobiliário / HGLG11 → fii
- Bitcoin / cripto / ETH → criptomoedas
- Previdência / PGBL / VGBL → previdencia
- Poupança → poupanca
- ETF / BOVA11 / IVVB11 → etf

Mapeamento de palavras → investment_operation:
- investi / apliquei / aporte / comprei → deposit
- resgatei / vendi (investimento) / saquei → withdraw
- rendimento / juros / lucro / dividendo → yield
- prejuízo / perda / perdi → loss

### 2. Deletar transação
{ "type": "delete_transaction", "payload": { "id": "string" } }

### 3. Deletar múltiplas
{ "type": "delete_all_transactions", "payload": { "filter": "all" | "income" | "expense" } }

### 4. Buscar na internet (dados ao vivo)
{ "type": "web_search", "payload": { "query": "string" } }

### 5. Atualizar dados fiscais (IRPF) de UMA transação existente
{
  "type": "update_transaction_fiscal",
  "payload": {
    "id": "uuid-da-transacao-do-contexto",
    "taxId": "CPF/CNPJ da contraparte (opcional)",
    "irpfCategory": "Ex: 'Despesa Médica', 'Rendimento Isento' (opcional)",
    "receiptUrl": "https://... (opcional)"
  }
}
- Use APENAS ids que aparecem em TRANSAÇÕES RECENTES. NUNCA invente id.
- Inclua no payload SOMENTE os campos que o usuário pediu para mudar. Omitir um campo = manter como está.
- Se o usuário não identificar claramente a transação (data + valor + descrição), NÃO gere a action — peça esclarecimento em "message".

### 6. Atualizar dados fiscais (IRPF) de UM investimento existente
{
  "type": "update_investment_fiscal",
  "payload": {
    "id": "uuid-do-investimento-do-contexto",
    "averagePrice": 32.75,
    "custodianCnpj": "00.000.000/0000-00"
  }
}
- Use APENAS ids da lista INVESTIMENTOS DO USUÁRIO. NUNCA invente id.
- Inclua no payload só os campos alterados. averagePrice é número (preço médio de aquisição).
- Ex.: "atualiza o preço médio do ITSA4 para 10,20" → localize o investimento em INVESTIMENTOS DO USUÁRIO, use o id dele, envie averagePrice=10.20.


OBRIGATÓRIO usar web_search SEMPRE que o usuário pedir:
- Cotações ao vivo (dólar, euro, libra, bitcoin, ethereum, ações, FII)
- Indicadores econômicos atuais (SELIC, CDI, IPCA, inflação)
- Notícias recentes / fatos do dia
- Qualquer informação dependente de "hoje", "agora", "atual", "este mês"

⚠️ NUNCA invente cotações, taxas, preços, percentuais ou notícias.
⚠️ NUNCA diga "minha base de dados acompanha o mercado até 2024", "meu conhecimento vai até [ano]", "knowledge cutoff", ou cite anos do seu treinamento. A data real é fornecida abaixo no contexto — use-a.
⚠️ Se a pergunta exigir dado externo ao vivo, a "message" deve ser curta ("Buscando informações atualizadas...") e você DEVE emitir uma action web_search. O resultado real virá da busca, não da sua memória.


## 🧠 REGRAS DE INTERPRETAÇÃO

### Receita (income)
Detectar quando houver: "ganhei", "recebi", "entrou", "salário", "freelance", "pix recebido", "vendi", "rendimento".
→ "type": "income"

### Despesa (expense)
Detectar quando houver: "gastei", "paguei", "comprei", "uber", "mercado", "ifood", "aluguel", "conta", "boleto".
→ "type": "expense"

## 💰 REGRAS DE VALOR
- Sempre extrair número limpo.
- Ignorar "R$", espaços, separadores de milhar.
- Vírgula é separador decimal no padrão BR.
- Exemplo: "R$ 1.200,50" → 1200.50

## 📅 REGRAS DE DATA
- Se o usuário não informar data, usar a data de hoje (informada no contexto).
- Formato obrigatório: "YYYY-MM-DD".

## 🏷️ CATEGORIZAÇÃO (OBRIGATÓRIO usar EXATAMENTE estes valores)

**Despesas (expense):**
- alimentacao → ifood, restaurante, mercado, supermercado, lanche, padaria
- transporte → uber, 99, taxi, combustível, gasolina, ônibus, metrô
- moradia → aluguel, condomínio, luz, água, gás, internet residencial
- saude → farmácia, médico, consulta, plano de saúde, exame
- lazer → cinema, viagem, bar, jogo, passeio
- educacao → curso, escola, faculdade, livro
- vestuario → roupa, sapato, calçado
- assinaturas → netflix, spotify, prime, disney, hbo
- outros_despesa → quando nenhuma acima se encaixar

**Receitas (income):**
- salario → salário, ordenado, holerite
- freelance → freela, projeto, bico
- investimentos → dividendos, juros, rendimento
- vendas → venda de produto/item
- outros_receita → quando nenhuma acima se encaixar

## 🔁 MULTI-TURN (IMPORTANTE)

Se faltar informação essencial (ex: valor ausente, ou categoria totalmente ambígua):
- NÃO gerar action.
- Responder apenas com pergunta natural na "message" e "actions": [].

Se o contexto contém active_intent (intent + partial + missing_field), o usuário está respondendo a uma pergunta anterior. Combine os dados parciais com a nova mensagem e emita a action completa. NÃO peça novamente o que já tem.

## 🚫 QUANDO NÃO GERAR ACTION
- Usuário está perguntando algo (ex: "quanto gastei esse mês?").
- Mensagem ambígua.
- Falta valor.

## ✅ QUANDO GERAR ACTION
Apenas quando tiver:
- tipo (income/expense) claro
- valor numérico
- categoria mínima inferível pela descrição

## 🧾 MÚLTIPLAS TRANSAÇÕES
"gastei 50 no uber e 30 no ifood" → 2 actions de add_transaction no array.

## ⚠️ ALERTAS
Se uma despesa > 20% da renda mensal (income_month do contexto), inclua na "message":
"⚠️ Esta compra de R$ X representa Y% da sua renda mensal."

## 🛡️ REGRAS DE SEGURANÇA
- Nunca inventar valores.
- Nunca executar ação sem certeza.
- Nunca gerar JSON inválido.
- Nunca omitir campos obrigatórios.

## COMANDOS ESPECIAIS
- /monthly_report → relatório mensal completo em markdown na "message" (sem actions).
- "score financeiro" / "saúde financeira" → use health_score do contexto.

## 🧾 EXEMPLOS

Entrada: "gastei 50 com uber"
Saída:
{
  "message": "Registrei sua despesa de R$ 50,00 com transporte (uber).",
  "actions": [
    { "type": "add_transaction", "payload": { "type": "expense", "amount": 50, "category": "transporte", "description": "uber", "date": "2025-05-07" } }
  ]
}

Entrada: "recebi 3000 de salário"
Saída:
{
  "message": "Boa! Registrei sua receita de R$ 3.000,00 (salário).",
  "actions": [
    { "type": "add_transaction", "payload": { "type": "income", "amount": 3000, "category": "salario", "description": "salário", "date": "2025-05-07" } }
  ]
}

Entrada: "gastei 50"
Saída:
{
  "message": "Em qual categoria foi esse gasto de R$ 50,00?",
  "actions": []
}

Entrada: "quanto gastei esse mês?"
Saída:
{
  "message": "Suas despesas do mês corrente somam **R$ X,XX**. Quer ver o detalhamento por categoria?",
  "actions": []
}`;

function verifyAuth(req: Request): { token: string } | { error: Response } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { token: authHeader.replace("Bearer ", "") };
}

async function getAuthenticatedUserId(token: string): Promise<{ userId: string } | { error: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authCheck = verifyAuth(req);
    if ("error" in authCheck) return authCheck.error;
    const authResult = await getAuthenticatedUserId(authCheck.token);
    if ("error" in authResult) return authResult.error;

    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Muitas mensagens no histórico" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    for (const msg of messages) {
      if (!msg?.role || !msg?.content || typeof msg.content !== 'string' || msg.content.length > MAX_MESSAGE_LENGTH || !['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: "Formato de mensagem inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (context && JSON.stringify(context).length > MAX_CONTEXT_SIZE) {
      return new Response(JSON.stringify({ error: "Dados de contexto muito grandes" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuração de serviço incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const periodLabel = context?.period_label || 'Todo período';
    const periodStart = context?.period_start;
    const periodEnd = context?.period_end;
    const periodLine = periodStart && periodEnd ? `${periodLabel} (de ${periodStart} até ${periodEnd})` : periodLabel;

    let contextMessage = `\n\n## PERÍODO DE ANÁLISE ATIVO: ${periodLine}

## DADOS FINANCEIROS DO USUÁRIO (no período):
- Saldo: R$ ${context?.balance?.toFixed(2) || '0.00'}
- Receitas: R$ ${context?.income?.toFixed(2) || '0.00'}
- Despesas: R$ ${context?.expenses?.toFixed(2) || '0.00'}
- Receitas do mês corrente: R$ ${context?.income_month?.toFixed(2) || '0.00'}
- Despesas do mês corrente: R$ ${context?.expenses_month?.toFixed(2) || '0.00'}
- Taxa de poupança: ${context?.savings_rate ?? 0}%
- Score financeiro: ${context?.health_score ?? 0}/100
- Data de hoje: ${new Date().toISOString().split('T')[0]}`;

    if (context?.top_categories && Array.isArray(context.top_categories)) {
      contextMessage += `\n\n## TOP CATEGORIAS DE GASTOS:`;
      for (const cat of context.top_categories) {
        contextMessage += `\n- ${cat.category}: R$ ${Number(cat.amount).toFixed(2)}`;
      }
    }

    if (context?.insights && Array.isArray(context.insights) && context.insights.length > 0) {
      contextMessage += `\n\n## INSIGHTS DETECTADOS:`;
      for (const insight of context.insights) contextMessage += `\n- ${insight}`;
    }

    contextMessage += `\n\n## PATRIMÔNIO:
- Saldo Disponível: R$ ${(context?.available_balance ?? 0).toFixed(2)}
- Saldo Investido: R$ ${(context?.invested_balance ?? 0).toFixed(2)}
- Patrimônio Total: R$ ${(context?.net_worth ?? 0).toFixed(2)}`;
    if (context?.investment_summary) {
      const s = context.investment_summary;
      contextMessage += `\n- Aportes acumulados: R$ ${Number(s.deposits || 0).toFixed(2)} | Resgates: R$ ${Number(s.withdraws || 0).toFixed(2)} | Rendimentos: R$ ${Number(s.yields || 0).toFixed(2)} | Prejuízos: R$ ${Number(s.losses || 0).toFixed(2)}`;
    }

    if (context?.recentTransactions && Array.isArray(context.recentTransactions)) {
      contextMessage += `\n\n## TRANSAÇÕES RECENTES (para referência em exclusões):`;
      for (const tx of context.recentTransactions.slice(0, 10)) {
        const typeLabel = tx.type === 'income' ? 'Receita' : tx.type === 'investment' ? 'Investimento' : 'Despesa';
        contextMessage += `\n- ID: ${tx.id} | ${typeLabel}: R$ ${Number(tx.amount).toFixed(2)} | Categoria: ${tx.category} | Data: ${tx.date}${tx.description ? ` | Descrição: ${tx.description}` : ''}`;
      }
    }

    if (context?.active_intent) {
      contextMessage += `\n\n## INTENT ATIVA (multi-turn):
O usuário está completando uma intenção anterior. Combine os dados parciais com a nova mensagem e emita a action final.
Intent: ${context.active_intent.intent}
Campo faltante: ${context.active_intent.missing_field || 'desconhecido'}
Dados parciais: ${JSON.stringify(context.active_intent.partial || {})}`;
    }

    contextMessage += `\n\n## ORÇAMENTOS: Não configurados pelo usuário.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione mais créditos na sua conta." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
