import { TrendingUp, TrendingDown, BarChart3, Activity, PlusCircle, Globe } from 'lucide-react';

export const CHAT_TIMEOUT_MS = 60000;

export const QUICK_ACTIONS = [
  { label: 'Qual meu patrimônio?', icon: Activity },
  { label: 'Quanto gastei este mês?', icon: TrendingDown },
  { label: 'Analise minhas despesas', icon: BarChart3 },
  { label: 'Mostre meus investimentos', icon: TrendingUp },
  { label: 'Cotação do dólar', icon: Globe },
  { label: 'Quanto posso economizar?', icon: PlusCircle },
];

export const INPUT_SUGGESTIONS = [
  'Quanto gastei com alimentação?',
  'Qual minha média mensal?',
  'Cotação do euro hoje',
  'Score financeiro',
];
