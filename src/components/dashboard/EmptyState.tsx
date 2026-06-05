import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className || ''}`}>
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 mb-4">
        <Icon className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 text-balance">{description}</p>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
