import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactionsContext, TransactionType, InvestmentOperation } from '@/contexts/TransactionsContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVESTMENT_TYPES, INVESTMENT_OPERATIONS, formatCurrency } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { getLocalISODate } from '@/lib/dateUtils';
import { normalizeAmount } from '@/lib/transactionNormalization';

export function TransactionForm() {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalISODate());
  const [investmentOperation, setInvestmentOperation] = useState<InvestmentOperation>('deposit');
  const [investmentType, setInvestmentType] = useState<string>('cdb');
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);

  const { addTransaction } = useTransactionsContext();
  const { toast } = useToast();

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const resetType = (t: TransactionType) => {
    setType(t);
    setCategory('');
  };

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
      category: type === 'investment' ? 'investimento' : category,
      description: description || undefined,
      transaction_date: date,
      source: 'manual',
      investment_operation: type === 'investment' ? investmentOperation : undefined,
      investment_type: type === 'investment' ? investmentType : undefined,
      institution: type === 'investment' ? (institution || undefined) : undefined,
    });
    setLoading(false);

    if (result) {
      const title = type === 'income'
        ? '💰 Receita adicionada!'
        : type === 'investment'
          ? '💼 Investimento registrado!'
          : '💸 Despesa registrada!';
      toast({ title, description: formatCurrency(numAmount) });
      setAmount('');
      setCategory('');
      setDescription('');
      setInstitution('');
    }
  };

  const canSubmit = type === 'investment' ? !!investmentType && !!investmentOperation : !!category;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Nova Transação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} onClick={() => resetType('expense')}>Despesa</Button>
            <Button type="button" variant={type === 'income' ? 'default' : 'outline'} onClick={() => resetType('income')}>Receita</Button>
            <Button type="button" variant={type === 'investment' ? 'default' : 'outline'} onClick={() => resetType('investment')}>Investimento</Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>

          {type === 'investment' ? (
            <>
              <div className="space-y-2">
                <Label>Operação</Label>
                <Select value={investmentOperation} onValueChange={(v) => setInvestmentOperation(v as InvestmentOperation)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_OPERATIONS.map(op => (
                      <SelectItem key={op.value} value={op.value}>{op.icon} {op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de investimento</Label>
                <Select value={investmentType} onValueChange={setInvestmentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Instituição (opcional)</Label>
                <Input id="institution" type="text" placeholder="Ex: Nubank, XP, BTG..." value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </div>
            </>
          ) : (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" type="text" placeholder={type === 'investment' ? 'Ex: CDB Nubank 110% CDI' : 'Ex: Almoço no restaurante'} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Adicionar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
