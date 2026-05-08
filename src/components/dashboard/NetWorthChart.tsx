import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';

interface Props {
  data: { month: string; available: number; invested: number; total: number }[];
}

export function NetWorthChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Evolução Patrimonial</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhum dado patrimonial</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Evolução Patrimonial</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
            />
            <Legend formatter={(v) => <span className="text-xs">{v === 'available' ? 'Disponível' : v === 'invested' ? 'Investido' : 'Patrimônio Total'}</span>} />
            <Line type="monotone" dataKey="available" stroke="hsl(165, 45%, 40%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="invested" stroke="hsl(215, 50%, 35%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="total" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
