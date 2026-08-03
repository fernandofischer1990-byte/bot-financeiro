# Benchmarking do PRD "Corrida pela Saúde" aplicado ao FinBot

O PRD é de outro produto (ação promocional gamificada com QR Codes, stands, staff e ranking). Nada da sua identidade, telas, nomenclaturas ou regras entra no FinBot. O que ele traz de valioso são **práticas transversais de produto**: auditoria completa, configurações administráveis, analytics de funil, padronização de mensagens, estados de carregamento, orçamentos de performance e RBAC.

## Estado atual verificado

- Tabelas existentes: `transactions`, `investments`, `profiles`, `chat_messages`, `category_mappings`, `import_history`, `mapping_templates`, `analytics_events`.
- `analytics_events` existe no banco mas **não é usada por nenhum código do app** (nenhuma referência em `src/`).
- Não existe tabela de auditoria (antes/depois) nem tabela de preferências do usuário.
- Feedback ao usuário é feito com `toast(...)` espalhado em ~10 arquivos, com textos ad-hoc; só a importação tem tradutor de erros (`src/lib/importErrors.ts`).
- Skeletons/erros/vazios estão implementados caso a caso (`Dashboard.tsx`, `EmptyState.tsx`, `InvestmentsTab.tsx`), sem componente comum.
- A meta de taxa de poupança (20%) está fixa em código (`Dashboard.tsx`, `InsightsPanel`).

## Oportunidades classificadas

### Alta prioridade (implementar agora — aditivo, sem mudar lógica financeira)

1. **Histórico de atividades / auditoria** (PRD RF-029/RF-030)
   Hoje não há como o usuário saber "quem/quando/o que mudou" numa transação — especialmente com três origens de escrita (manual, importação, chat/MCP). Nova tabela `activity_log` própria do usuário (RLS estrita, só leitura para o dono) registrando ação, entidade, id, origem e snapshot antes/depois. Nova aba "Histórico" com filtros por período, entidade e ação.

2. **Camada padronizada de feedback** (PRD RF-031, seção 50 de erros)
   Catálogo único de mensagens PT-BR + tradutor de erros técnicos (generalizando o que já existe para importação) para que erros de rede/RLS/validação nunca cheguem crus ao usuário. Adotado nos pontos de escrita existentes, sem alterar fluxos.

3. **Instrumentação de analytics de jornada** (PRD RF-027)
   Passar a usar a tabela `analytics_events` já provisionada: eventos de cadastro concluído, primeira transação, importação concluída, uso do chat, investimento cadastrado. Habilita medir conversão por etapa sem nenhuma mudança de UX.

4. **Padronização de estados (carregando / erro / vazio)**
   Um componente comum reutilizado nos módulos, mantendo exatamente o visual Midnight Indigo atual — reduz duplicação e garante que todo módulo tenha os três estados.

### Média prioridade (proposto, não implementado nesta rodada)

5. **Configurações administráveis do usuário** (PRD RF-026): meta de taxa de poupança, moeda de exibição, alerta de despesa relevante — hoje constantes no código.
6. **Relatórios ampliados** (RF-028/RF-032): exportar auditoria e investimentos, além do CSV atual.
7. **Performance e escala** (seções 51/52): paginação/virtualização da lista de transações e orçamentos de tempo por tela.
8. **Rate limiting nas edge functions** de chat e web-search (PRD seção 46).

### Baixa prioridade / não aplicável

9. **RBAC com papéis Admin/Staff/Operador** (PRD seção 45): o FinBot é multi-tenant por usuário, sem operação de bastidores — só faz sentido se houver painel administrativo real no futuro.
10. **Notificações e webhooks** (RF-031, seção 101): sem canal externo definido, agrega pouco hoje.
11. **QR Code, stands, ranking, elegibilidade, benefícios**: exclusivos do PRD, descartados.

## Detalhes técnicos da implementação (itens 1 a 4)

- Migração: `public.activity_log` (`id`, `user_id`, `action`, `entity`, `entity_id`, `source`, `before jsonb`, `after jsonb`, `created_at`), índice por `(user_id, created_at desc)`, `GRANT SELECT, INSERT` para `authenticated`, `GRANT ALL` para `service_role`, RLS com `SELECT`/`INSERT`/`DELETE` restritos a `auth.uid() = user_id`.
- `src/services/activityLogService.ts` — gravação best-effort (falha de log nunca quebra a operação financeira) e consulta com filtros.
- Ganchos de registro nos serviços já existentes de transações e investimentos, sem alterar suas assinaturas nem os cálculos de `metricsCalculator.ts`.
- `src/lib/feedback.ts` — catálogo de mensagens + `translateError()` reaproveitando `importErrors.ts`.
- `src/services/analyticsService.ts` — `track(event, properties)` gravando em `analytics_events`, chamado nos pontos de jornada.
- `src/components/common/DataState.tsx` — estados skeleton/erro/vazio com os tokens semânticos atuais.
- Nova aba "Histórico" registrada em `NAV_ITEMS` (`AppSidebar`/`BottomNav`) e renderizada em `Index.tsx`.

Nenhuma regra financeira, fórmula de saldo, escopo `operational`/`investment` ou identidade visual é alterada.
