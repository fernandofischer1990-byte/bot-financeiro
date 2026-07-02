
## Migração para Login Exclusivo com Google

Nota: o projeto roda em **Lovable Cloud (Supabase)**, não Firebase. Aplico o objetivo da sprint no stack real, mantendo o `auth.uid` como chave em todas as tabelas (`transactions`, `investments`, `profiles`, `chat_messages`, `analytics_events`, `import_history`, `mapping_templates`, `category_mappings`). Nenhuma tabela, RLS, cálculo financeiro ou dado é alterado.

### 1. Backend / Auth config
- Habilitar Google e desabilitar email como método via `configure_social_auth({ providers: ["google"], disable_providers: ["email"] })`.
- Isso instala `@lovable.dev/cloud-auth-js` e gera `src/integrations/lovable/` (não editar manualmente).
- O trigger `handle_new_user` já cria automaticamente `public.profiles` no primeiro login com `full_name` vindo do metadata do Google — não precisa mexer.

### 2. `useAuth` (`src/hooks/useAuth.tsx`)
Refatorar mantendo o mesmo shape público mínimo:
- Remover `signUp`, `signIn` (email/senha).
- Adicionar `signInWithGoogle()` usando `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` com tratamento de `result.error`, `result.redirected` e casos "popup fechado / cancelado".
- Manter `signOut`, listener `onAuthStateChange`, recuperação de sessão e safety-net de 8s (persistência oficial do Supabase já cobre refresh automático).
- Atualizar `trackEvent` para `method: 'google'`.

### 3. Nova `AuthPage` (`src/components/auth/AuthPage.tsx`)
Reescrever no tema Midnight Indigo atual:
- Logo FinBot + nome + tagline curta.
- Botão único **"Entrar com Google"** (com ícone Google oficial em SVG inline, spinner durante loading, disabled enquanto processa).
- Copy: "Seus dados permanecem protegidos pela autenticação segura do Google."
- Remover: inputs de email/senha/nome/confirmar senha, toggle login/cadastro, link "esqueci senha", mostrar/ocultar senha, toda validação de senha.
- Estados tratados: loading, erro genérico (toast), popup cancelado (mensagem amigável, sem toast intrusivo).

### 4. Limpeza técnica
- Remover imports órfãos (`Input`, `Label`, `useState` de email/password, etc.).
- Buscar e remover qualquer referência residual a `signUp`/`signIn`/`signInWithPassword`/`resetPasswordForEmail`/`updateUser({ password })` no `src/`.
- Não existem rotas separadas `/register`, `/forgot-password`, `/reset-password` no projeto (verificado em `App.tsx`), então nada de rota para remover.
- Rodar typecheck; garantir zero warnings/erros.

### 5. Segurança e UX
- Sessão persistente e refresh automático já são default do cliente Supabase existente (`persistSession: true, autoRefreshToken: true`). Não duplicar listeners.
- Loading global do `AuthProvider` já evita flash de tela.
- Após `SIGNED_IN`, `Index.tsx` renderiza dashboard automaticamente — sem reload, sem flicker.

### Fora de escopo (não vou tocar)
- Nenhuma tabela, RLS, edge function ou lógica financeira.
- Nenhum recálculo de saldo/receita/despesa/investimento.
- Estrutura do banco permanece intacta; usuários existentes que fizerem login pelo Google com o mesmo email do cadastro atual recebem novo `auth.uid` (contas criadas por email/senha não são automaticamente mescladas — isso é comportamento do Supabase). Se você tiver usuários reais em produção que precisam manter dados, me avise antes de aplicar para eu preparar uma migração de vínculo por email.

### Arquivos afetados
- `src/hooks/useAuth.tsx` (refatorar)
- `src/components/auth/AuthPage.tsx` (reescrever)
- `src/integrations/lovable/*` (gerado automaticamente pela ferramenta)
- `package.json` (dependência `@lovable.dev/cloud-auth-js` adicionada pela ferramenta)

### Critérios de aceite atendidos
Login apenas via Google · sem cadastro/recuperação/troca de senha · UID (`auth.uid`) permanece a chave · nenhuma tabela alterada · nenhum dado perdido · build limpa.
