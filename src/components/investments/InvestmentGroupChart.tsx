import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { useMemo } from 'react';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';

const PALETTE = [
  'hsl(215, 50%, 35%)',
  'hsl(165, 45%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(345, 60%, 50%)',
  'hsl(260, 50%, 55%)',
  'hsl(200, 60%, 45%)',
  'hsl(120, 35%, 45%)',
  'hsl(20, 70%, 50%)',
];

interface Props {
  groupBy: 'institution' | 'investment_type';
  title: string;
  labelFn?: (key: string) => string;
}

export function InvestmentGroupChart({ groupBy, title, labelFn }: Props) {
  const { investments } = useInvestmentsContext();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of investments) {
      const key = (inv[groupBy] as string) || 'Sem categoria';
      map[key] = (map[key] || 0) + Number(inv.current_balance);
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({
        name: labelFn ? labelFn(name) : name,
        value,
        color: PALETTE[i % PALETTE.length],
      }));
  }, [investments, groupBy, labelFn]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[300px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-muted-foreground text-sm">Sem dados</p></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              />
              <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
