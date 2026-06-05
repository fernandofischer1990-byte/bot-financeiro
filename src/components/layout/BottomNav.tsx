import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './AppSidebar';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (v: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  // Mobile shows 5 most important items
  const items = NAV_ITEMS.filter((i) => i.value !== 'reports');
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t no-print"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.value;
          return (
            <li key={item.value}>
              <button
                onClick={() => onTabChange(item.value)}
                className={cn(
                  'w-full h-full flex flex-col items-center justify-center gap-1 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
