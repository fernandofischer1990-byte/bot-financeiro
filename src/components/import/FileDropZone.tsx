import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, FileText, File } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = ['csv', 'xls', 'xlsx', 'ods', 'tsv', 'pdf', 'ofx', 'qif'];

export function FileDropZone({ onFileSelected, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  }, [disabled, onFileSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
        ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',')}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      
      <Upload className={`h-10 w-10 mx-auto mb-4 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
      
      <p className="text-base font-medium mb-1">
        {isDragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para selecionar'}
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Suporte a diversos formatos de arquivo financeiro
      </p>

      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          PDF (Extrato)
        </span>
        <span className="flex items-center gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          CSV, XLS, XLSX
        </span>
        <span className="flex items-center gap-1.5">
          <File className="h-3.5 w-3.5" />
          OFX, QIF
        </span>
      </div>
    </div>
  );
}
