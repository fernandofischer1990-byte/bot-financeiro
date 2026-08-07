import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './AppSidebar';

export function BottomNav() {
  // Mobile shows 5 most important items
  const items = NAV_ITEMS.filter((i) => i.value !== 'reports' && i.value !== 'history');
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t no-print"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.value}>
              <NavLink
                to={item.path}
                aria-label={item.label}
                className={({ isActive }) =>
                  cn(
                    'w-full h-full flex flex-col items-center justify-center gap-1 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
