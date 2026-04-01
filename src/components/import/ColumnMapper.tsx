import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertTriangle, Info, Save, Trash2, FolderOpen } from 'lucide-react';
import { MappingTemplate } from '@/services/mappingTemplateService';

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  type: string;
  category: string;
  income: string;
  expense: string;
}

const TARGET_FIELDS = [
  { key: 'date', label: 'Data', required: true },
  { key: 'amount', label: 'Valor', required: false },
  { key: 'income', label: 'Receita', required: false },
  { key: 'expense', label: 'Despesa', required: false },
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
  templates: MappingTemplate[];
  onSaveTemplate: (name: string) => void;
  onDeleteTemplate: (id: string) => void;
  onLoadTemplate: (template: MappingTemplate) => void;
}

export function ColumnMapper({
  sourceColumns,
  sampleData,
  mapping,
  onMappingChange,
  onConfirm,
  onBack,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onLoadTemplate,
}: ColumnMapperProps) {
  const [templateName, setTemplateName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const hasSplitColumns = mapping.income !== '' && mapping.expense !== '';
  const isValid = mapping.date !== '' && (mapping.amount !== '' || mapping.income !== '' || mapping.expense !== '');

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [field]: value === IGNORE_VALUE ? '' : value });
  };

  const previewRows = useMemo(() => sampleData.slice(0, 3), [sampleData]);

  const visibleFields = TARGET_FIELDS.filter(field => {
    if (field.key === 'amount' && hasSplitColumns) return false;
    if (field.key === 'type' && hasSplitColumns) return false;
    return true;
  });

  const handleSave = () => {
    if (templateName.trim()) {
      onSaveTemplate(templateName.trim());
      setTemplateName('');
      setShowSave(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {templates.length > 0 && (
          <Select onValueChange={(id) => {
            const t = templates.find(t => t.id === id);
            if (t) onLoadTemplate(t);
          }}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <FolderOpen className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Carregar template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between pr-1">
                  <SelectItem value={t.id} className="flex-1 text-xs">{t.name}</SelectItem>
                  <button
                    className="p-1 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </SelectContent>
          </Select>
        )}

        {showSave ? (
          <div className="flex items-center gap-1">
            <Input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="Nome do template..."
              className="h-8 w-44 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleSave} disabled={!templateName.trim()}>
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowSave(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSave(true)}>
            <Save className="h-3 w-3 mr-1" /> Salvar template
          </Button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-1">Mapeamento de Colunas</h3>
        <p className="text-xs text-muted-foreground">
          Associe as colunas do seu arquivo aos campos do sistema. Campos obrigatórios: Data e pelo menos um campo de valor.
        </p>
      </div>

      {hasSplitColumns && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Info className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-xs text-primary">
            Colunas Receita e Despesa detectadas. Transações serão classificadas automaticamente.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {visibleFields.map(field => {
          const isRequiredField = field.key === 'date' || 
            (field.key === 'amount' && !hasSplitColumns && !mapping.income && !mapping.expense);
          return (
            <div key={field.key} className="flex items-center gap-3">
              <div className="w-40 flex items-center gap-2">
                <span className="text-sm">{field.label}</span>
                {field.key === 'date' && <Badge variant="outline" className="text-[10px] px-1.5">Obrigatório</Badge>}
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
              ) : isRequiredField ? (
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              ) : null}
            </div>
          );
        })}
      </div>

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
