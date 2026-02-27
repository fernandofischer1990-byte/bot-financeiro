import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatCurrency } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { getLocalISODate } from '@/lib/dateUtils';
import { normalizeAmount } from '@/lib/transactionNormalization';

export function TransactionForm() {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalISODate());
  const [loading, setLoading] = useState(false);
  
  const { addTransaction } = useTransactionsContext();
  const { toast } = useToast();
  
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numAmount = normalizeAmount(amount);
    if (numAmount === null || numAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'Digite um valor numérico maior que zero', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const result = await addTransaction({
      type,
      amount: numAmount,
      category,
      description: description || undefined,
      transaction_date: date,
      source: 'manual',
    });
    setLoading(false);

    if (result) {
      toast({
        title: type === 'income' ? '💰 Receita adicionada!' : '💸 Despesa registrada!',
        description: formatCurrency(numAmount),
      });
      setAmount('');
      setCategory('');
      setDescription('');
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Nova Transação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} onClick={() => { setType('expense'); setCategory(''); }} className="flex-1">Despesa</Button>
            <Button type="button" variant={type === 'income' ? 'default' : 'outline'} onClick={() => { setType('income'); setCategory(''); }} className="flex-1">Receita</Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.icon} {cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" type="text" placeholder="Ex: Almoço no restaurante" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !category}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Adicionar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
