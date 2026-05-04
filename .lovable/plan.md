## Corrigir filtro de datas personalizado (Dashboard)

### Problema identificado

No dashboard, ao escolher "Personalizado" no seletor de período, o popover do calendário abre, mas **clicar nos dias não seleciona nada**. O calendário no chat funciona porque já tem o ajuste correto.

### Causa raiz

O componente `src/components/ui/calendar.tsx` aplica apenas `cn("p-3", className)` no `DayPicker`. Quando o calendário é renderizado dentro de um `Popover` do Radix, o Radix bloqueia `pointer-events` no body enquanto o popover está aberto — isso impede cliques nos dias do calendário.

Em `DashboardFilters.tsx`, o `<Calendar mode="range" .../>` é usado sem passar `className="pointer-events-auto"`, então os cliques são engolidos. No `ChatInterface.tsx`, o mesmo `<Calendar>` funciona porque já passa `className="p-3 pointer-events-auto"` explicitamente.

Há um detalhe adicional: o handler atual `handleCustomDateSelect` só atualiza o estado quando `range.from` E `range.to` estão presentes. Isso faz o calendário parecer travado no primeiro clique (o usuário clica e nada visível acontece até o segundo clique). Vamos refletir o `from` imediatamente para dar feedback visual.

### Mudanças

**1. `src/components/ui/calendar.tsx`** — adicionar `pointer-events-auto` por padrão para que o componente funcione corretamente em qualquer Popover/Dialog (alinha com a recomendação oficial do shadcn):

```tsx
className={cn("p-3 pointer-events-auto", className)}
```

**2. `src/components/dashboard/DashboardFilters.tsx`** — melhorar `handleCustomDateSelect` para refletir a seleção parcial (somente `from`) na UI e só fechar o popover quando o range estiver completo:

```tsx
const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
  if (!range) return;
  const start = range.from ? startOfDay(range.from) : null;
  const end = range.to ? endOfDay(range.to) : null;
  onFiltersChange({ ...filters, period: 'custom', startDate: start, endDate: end });
  if (start && end) setIsCustomOpen(false);
};
```

### Resultado esperado

- Clicar em um dia já destaca a data inicial (feedback imediato).
- Clicar no segundo dia completa o intervalo, fecha o popover e aplica o filtro.
- Funciona tanto no Dashboard quanto em qualquer outro lugar que use `<Calendar>` em Popover/Dialog.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/ui/calendar.tsx` | Adicionar `pointer-events-auto` à className padrão |
| `src/components/dashboard/DashboardFilters.tsx` | Aceitar seleção parcial e fechar só quando range completo |

Sem alterações em backend, edge functions ou banco de dados.