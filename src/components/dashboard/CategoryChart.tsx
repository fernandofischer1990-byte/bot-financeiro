import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCategoryLabel, formatCurrency, CATEGORY_COLORS } from '@/lib/constants';

interface CategoryChartProps {
  data: Record<string, number>;
}

const COLORS = [
  'hsl(215, 50%, 23%)',
  'hsl(165, 45%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 65%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(200, 70%, 50%)',
  'hsl(320, 60%, 50%)',
  'hsl(100, 50%, 45%)',
  'hsl(30, 70%, 50%)',
];

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([category, value], index) => ({
      name: getCategoryLabel(category),
      value,
      color: CATEGORY_COLORS[category] || COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (chartData.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Gastos por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhuma transação registrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Gastos por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend 
              layout="horizontal" 
              verticalAlign="bottom" 
              align="center"
              formatter={(value) => <span className="text-xs">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
