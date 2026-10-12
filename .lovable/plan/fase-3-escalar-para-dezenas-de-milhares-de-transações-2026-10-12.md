# Fase 3 — Escalar para dezenas de milhares de transações

Objetivo: o app abre rápido e continua leve com qualquer volume, sem baixar todas as transações de uma vez.

## O que muda para você
- O painel abre mostrando os totais na hora, calculados no banco.
- A lista de transações carrega por páginas ("Carregar mais" / rolagem contínua).
- Busca e filtros (tipo, categoria, período) passam a ser feitos no banco, cobrindo todo o histórico.
- Relatórios e IRPF buscam só o período escolhido.

## Etapas
1. **Painel só com o resumo do banco**: totais, categorias e séries mensais vêm exclusivamente do resumo agregado já existente; o cálculo local deixa de depender da lista completa.
2. **Lista paginada por cursor**: transações recentes carregadas em blocos de 50 (ordem data + id), com rolagem virtualizada.
3. **Filtros e busca no servidor**: filtros de tipo, categoria, período e texto viram parâmetros da consulta; índice de busca por descrição.
4. **Consultas sob demanda**: relatórios, exportação CSV, IRPF e detecção de duplicados na importação consultam só o intervalo necessário.
5. **Atualizações otimistas preservadas**: adicionar/editar/apagar atualiza a página visível e invalida o resumo do painel.
6. **Testes**: paginação por cursor, filtros no servidor e um teste de carga simulando 50.000 transações; limite do chunk inicial mantido no CI.

## Detalhes técnicos
- Nova função de serviço `fetchTransactionsPage({cursor, limit, filters})` usando keyset `(transaction_date, id)`; índice composto `(user_id, transaction_date desc, id desc)` e índice trigram (`pg_trgm`) em `description`.
- `TransactionsContext` deixa de manter o array completo; passa a guardar páginas + resumo da RPC `get_financial_metrics`.
- Chat/IA recebe contexto do resumo agregado + últimas transações, não o histórico inteiro.
- Remover o teto de 50.000 em `fetchUserTransactions` após migrar todos os consumidores.
