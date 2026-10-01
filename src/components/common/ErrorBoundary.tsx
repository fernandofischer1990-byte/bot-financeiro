import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorId: string | null;
  requestId: string | null;
}

/**
 * Barreira de erro global (A3): impede que uma exceção de render derrube
 * a aplicação inteira em tela branca.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorId: null, requestId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { errorId, requestId } = reportError(error, 'ErrorBoundary', {
      componentStack: info.componentStack?.slice(0, 2000),
    });
    this.setState({ errorId, requestId });
  }

  private handleReset = () => {
    this.setState({ error: null, errorId: null, requestId: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao exibir esta tela. Seus dados financeiros estão salvos.
          </p>
          <p className="break-words rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          {this.state.errorId && (
            <p className="text-xs text-muted-foreground">
              Código do erro: <span className="font-mono">{this.state.errorId}</span>
              {this.state.requestId && (
                <> · requisição <span className="font-mono">{this.state.requestId.slice(0, 8)}</span></>
              )}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={this.handleReset}>Tentar novamente</Button>
            <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
