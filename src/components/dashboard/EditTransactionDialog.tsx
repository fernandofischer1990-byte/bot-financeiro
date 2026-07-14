import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Transaction } from '@/contexts/TransactionsContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeAmount } from '@/lib/transactionNormalization';

/** Format number for Brazilian display (e.g. 3326.61 → "3.326,61") */
function formatAmountBR(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SAVE_TIMEOUT_MS = 15000;

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
}

export function EditTransactionDialog({ transaction, open, onOpenChange, onSave }: EditTransactionDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFiscal, setShowFiscal] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [irpfCategory, setIrpfCategory] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  useEffect(() => {
    if (transaction) {
      setType(transaction.type === 'investment' ? 'expense' : transaction.type);
      setAmount(formatAmountBR(transaction.amount));
      setCategory(transaction.category);
      setDescription(transaction.description || '');
      setDate(transaction.transaction_date);
      setTaxId(transaction.taxId ?? '');
      setIrpfCategory(transaction.irpfCategory ?? '');
      setReceiptUrl(transaction.receiptUrl ?? '');
      setShowFiscal(Boolean(transaction.taxId || transaction.irpfCategory || transaction.receiptUrl));
    }
  }, [transaction]);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSave = async () => {
    if (!transaction) return;
    
    const numAmount = normalizeAmount(amount);
    if (numAmount === null || numAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'Digite um valor numérico maior que zero', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite excedido')), SAVE_TIMEOUT_MS)
      );
      
      const savePromise = onSave(transaction.id, {
        type, amount: numAmount, category,
        description: description || null,
        transaction_date: date,
        taxId: taxId.trim() || undefined,
        irpfCategory: irpfCategory.trim() || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
      });

      const success = await Promise.race([savePromise, timeoutPromise]);
      if (success) onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error && error.message === 'Tempo limite excedido' ? 'Tempo limite excedido. Verifique sua conexão.' : 'Falha ao salvar. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={(v) => { setType(v as 'income' | 'expense'); setCategory(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.icon} {cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !amount || !category}>
            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>) : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
