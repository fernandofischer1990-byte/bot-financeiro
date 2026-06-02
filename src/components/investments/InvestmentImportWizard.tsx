import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useInvestmentsContext } from '@/contexts/InvestmentsContext';
import { parseInvestmentSpreadsheet, ParsedInvestmentRow } from '@/lib/investmentSpreadsheetParser';
import { formatCurrency, getInvestmentTypeLabel } from '@/lib/constants';

type Step = 'upload' | 'parsing' | 'review' | 'saving' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvestmentImportWizard({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { addMultipleInvestments } = useInvestmentsContext();
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ParsedInvestmentRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [unknownCols, setUnknownCols] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setRows([]);
    setFileName('');
    setUnknownCols(new Set());
    setSavedCount(0);
  };

  const handleFile = async (file: File) => {
    setStep('parsing');
    setFileName(file.name);
    try {
      const { rows: parsed } = await parseInvestmentSpreadsheet(file);
      if (parsed.length === 0) {
        toast({ title: 'Nenhum investimento encontrado', description: 'Verifique se a planilha tem colunas como "Investimento", "Saldo" etc.', variant: 'destructive' });
        setStep('upload');
        return;
      }
      const unk = new Set<string>();
      for (const r of parsed) r.unknownColumns.forEach(c => unk.add(c));
      setUnknownCols(unk);
      setRows(parsed);
      setStep('review');
    } catch (e) {
      console.error('[InvestmentImport] parse error', e);
      toast({ title: 'Erro ao ler arquivo', description: e instanceof Error ? e.message : 'Falha desconhecida', variant: 'destructive' });
      setStep('upload');
    }
  };

  const confirm = async () => {
    setStep('saving');
    const count = await addMultipleInvestments(rows.map(r => r.input));
    setSavedCount(count);
    if (count > 0) toast({ title: `✅ ${count} investimento(s) importado(s)` });
    setStep('done');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Planilha de Investimentos
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <Card className="border-dashed border-2 cursor-pointer hover:border-primary transition-colors" onClick={() => inputRef.current?.click()}>
            <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Clique para selecionar uma planilha</p>
              <p className="text-xs text-muted-foreground">XLSX, XLS ou CSV. Todas as colunas são preservadas.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods,.tsv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </CardContent>
          </Card>
        )}

        {step === 'parsing' && (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando investimentos de <strong>{fileName}</strong>…</p>
          </div>
        )}

        {step === 'review' && (
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div>
                <span className="font-medium">{rows.length}</span> investimento(s) detectado(s) em <span className="font-medium">{fileName}</span>
              </div>
              {unknownCols.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{unknownCols.size} coluna(s) extra preservada(s) em metadata
                </Badge>
              )}
            </div>
            <div className="overflow-auto border rounded-lg max-h-[55vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Investimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Instituição</TableHead>
                    <TableHead className="text-right">Valor aplicado</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-[260px] truncate" title={r.input.investment_name}>{r.input.investment_name}</TableCell>
                      <TableCell><Badge variant="outline">{getInvestmentTypeLabel(r.input.investment_type)}</Badge></TableCell>
                      <TableCell>{r.input.institution || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(r.input.initial_amount || 0)}</TableCell>
                      <TableCell className="text-xs">{r.input.start_date || '—'}</TableCell>
                      <TableCell className="text-xs">{r.input.end_date || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {unknownCols.size > 0 && (
              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>Colunas extras preservadas como metadata: {Array.from(unknownCols).slice(0, 8).join(', ')}{unknownCols.size > 8 ? '…' : ''}</span>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={confirm}>Confirmar importação ({rows.length})</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'saving' && (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Salvando {rows.length} investimentos…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="font-medium">Importação concluída</p>
            <p className="text-sm text-muted-foreground">{savedCount} investimento(s) adicionado(s) ao seu patrimônio.</p>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
