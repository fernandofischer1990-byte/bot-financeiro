import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  type: string;
  category: string;
}

const TARGET_FIELDS = [
  { key: 'date', label: 'Data', required: true },
  { key: 'amount', label: 'Valor', required: true },
  { key: 'description', label: 'Descrição', required: false },
  { key: 'type', label: 'Tipo (receita/despesa)', required: false },
  { key: 'category', label: 'Categoria', required: false },
] as const;

const IGNORE_VALUE = '__ignore__';

interface ColumnMapperProps {
  sourceColumns: string[];
  sampleData: Record<string, unknown>[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function ColumnMapper({
  sourceColumns,
  sampleData,
  mapping,
  onMappingChange,
  onConfirm,
  onBack,
}: ColumnMapperProps) {
  const isValid = mapping.date !== '' && mapping.amount !== '';

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [field]: value === IGNORE_VALUE ? '' : value });
  };

  const previewRows = useMemo(() => sampleData.slice(0, 3), [sampleData]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-1">Mapeamento de Colunas</h3>
        <p className="text-xs text-muted-foreground">
          Associe as colunas do seu arquivo aos campos do sistema. Campos obrigatórios: Data e Valor.
        </p>
      </div>

      <div className="space-y-3">
        {TARGET_FIELDS.map(field => (
          <div key={field.key} className="flex items-center gap-3">
            <div className="w-40 flex items-center gap-2">
              <span className="text-sm">{field.label}</span>
              {field.required && <Badge variant="outline" className="text-[10px] px-1.5">Obrigatório</Badge>}
            </div>
            <Select
              value={mapping[field.key] || IGNORE_VALUE}
              onValueChange={(v) => handleChange(field.key, v)}
            >
              <SelectTrigger className="flex-1 h-9 text-sm">
                <SelectValue placeholder="Selecionar coluna..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={IGNORE_VALUE}>— Ignorar —</SelectItem>
                {sourceColumns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mapping[field.key] ? (
              <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
            ) : field.required ? (
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
            ) : null}
          </div>
        ))}
      </div>

      {/* Sample data preview */}
      {previewRows.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Preview dos dados:</p>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {sourceColumns.slice(0, 6).map(col => (
                    <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {sourceColumns.slice(0, 6).map(col => (
                      <TableCell key={col} className="text-xs py-2 whitespace-nowrap">
                        {String(row[col] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">Voltar</Button>
        <Button onClick={onConfirm} disabled={!isValid} className="flex-1">
          Continuar
        </Button>
      </div>
    </div>
  );
}
