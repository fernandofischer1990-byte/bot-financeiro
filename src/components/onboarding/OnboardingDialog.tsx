import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Wallet, Building2, Upload, Briefcase, LayoutDashboard, ArrowRight, Check } from 'lucide-react';

const STORAGE_KEY = 'finbot-onboarding-completed';

interface Step {
  icon: typeof Wallet;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { icon: Wallet, title: 'Bem-vindo ao FinBot', description: 'Seu copiloto financeiro com chat IA, dashboard executivo e segregação patrimonial entre saldo disponível e investimentos.' },
  { icon: Building2, title: 'Cadastre seu saldo inicial', description: 'Use a aba "Adicionar" para registrar uma receita inicial com o saldo atual da sua conta. Isso alimenta o Saldo Disponível.' },
  { icon: Upload, title: 'Importe extratos', description: 'Em "Importar", envie CSV, XLS, OFX ou PDF do seu banco. Detectamos duplicatas, categorias e formatos automaticamente.' },
  { icon: Briefcase, title: 'Cadastre seus investimentos', description: 'Na aba "Investimentos", adicione manualmente ou importe planilhas. O Saldo Investido é calculado automaticamente.' },
  { icon: LayoutDashboard, title: 'Explore o dashboard', description: 'Acompanhe Patrimônio Total, evolução mensal, distribuição patrimonial e insights automáticos. Pergunte ao chat: "Qual meu patrimônio?"' },
];

interface OnboardingDialogProps {
  onNavigate?: (tab: string) => void;
}

export function OnboardingDialog({ onNavigate }: OnboardingDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) complete(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="p-3 rounded-2xl gradient-primary shadow-elegant">
              <Icon className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-center text-balance pt-1">{current.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-center text-muted-foreground">
            Passo {step + 1} de {STEPS.length}
          </p>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={complete}>Pular tour</Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>Voltar</Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={() => { complete(); onNavigate?.('dashboard'); }}>
                <Check className="h-4 w-4 mr-1" /> Começar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
