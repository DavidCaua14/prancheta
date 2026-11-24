# Login com Google — passo a passo

O Supabase já está configurado do lado do Prancheta:

- **URL do site:** `https://prancheta-two.vercel.app`
- **Endereços de retorno permitidos:** `https://prancheta-two.vercel.app/**`, `http://localhost:3000/**` e
  `http://192.168.*.*:3000/**` (para testar no celular pela rede de casa)
- **Login por e-mail/senha:** desligado (só Google)

Falta só criar as chaves no Google e colar no Supabase. Leva uns 10 minutos.

---

## 1. Criar o projeto no Google Cloud

1. Acesse <https://console.cloud.google.com> com a conta Google que vai administrar o jogo.
2. No topo, clique no seletor de projetos → **Novo projeto**.
3. Nome: `Prancheta` → **Criar**. Confira se o projeto novo ficou selecionado no topo.

## 2. Configurar a tela de consentimento (o que o jogador vê ao entrar)

1. No menu ☰, vá em **APIs e serviços → Tela de consentimento OAuth**
   (em algumas contas aparece como **Google Auth Platform → Branding**). Clique em **Começar**.
2. **Informações do app:**
   - Nome do app: `Prancheta`
   - E-mail de suporte: o seu e-mail
3. **Público:** escolha **Externo**.
4. **Dados de contato:** o seu e-mail → aceite a política → **Criar**.
5. Em **Branding**, role até **Domínios autorizados** e adicione:
   - `prancheta-two.vercel.app`
   - `supabase.co`
   
   Opcional: envie o logo (`public/art/logo-mark.webp`, convertido para PNG 120×120) e os links de termos e
   privacidade quando existirem. **Salvar**.
6. Em **Acesso a dados** (ou **Escopos**), não precisa adicionar nada: o Supabase usa só `email`, `profile` e
   `openid`, que já são liberados por padrão.

## 3. Criar as credenciais (Client ID e Client Secret)

1. Vá em **APIs e serviços → Credenciais** (ou **Google Auth Platform → Clientes**).
2. **Criar credenciais → ID do cliente OAuth**.
3. Tipo de aplicativo: **Aplicativo da Web**. Nome: `Prancheta Web`.
4. **Origens JavaScript autorizadas** — adicione:
   - `https://prancheta-two.vercel.app`
   - `http://localhost:3000`
5. **URIs de redirecionamento autorizados** — adicione **exatamente**:
   ```
   https://sochoqusshdywnbqvzxv.supabase.co/auth/v1/callback
   ```
6. **Criar**. Vai aparecer uma janela com o **ID do cliente** e a **Chave secreta do cliente**.
   Deixe essa janela aberta (ou baixe o JSON).

> ⚠️ Não mande a chave secreta por chat, e-mail ou commit. Cole direto no Supabase (próximo passo).

## 4. Publicar o app no Google

Enquanto o app estiver "Em teste", só os e-mails cadastrados como testadores conseguem entrar.

1. Vá em **Tela de consentimento OAuth → Público** (ou **Google Auth Platform → Público**).
2. Clique em **Publicar app** → confirme.

Como o Prancheta só pede nome e e-mail, normalmente **não** precisa de verificação do Google.

## 5. Colar as chaves no Supabase

1. Acesse <https://supabase.com/dashboard/project/sochoqusshdywnbqvzxv/auth/providers>
   (**Authentication → Sign In / Providers**).
2. Clique em **Google** e ligue **Enable Sign in with Google**.
3. Cole o **Client ID** e o **Client Secret** do passo 3.
4. Confira se a **Callback URL** mostrada ali é `https://sochoqusshdywnbqvzxv.supabase.co/auth/v1/callback`.
5. **Save**.

## 6. Testar

1. Abra <https://prancheta-two.vercel.app/entrar>.
2. Clique em **Continuar com Google**, escolha a conta e autorize.
3. Você deve cair em **Fundar clube**. Depois de fundar, vai para a **Sede do clube**.

### Se algo der errado

| Mensagem | Causa provável | Como resolver |
| --- | --- | --- |
| "O login com Google ainda não foi ativado" (no Prancheta) | Provedor desligado no Supabase | Passo 5 |
| `redirect_uri_mismatch` (tela do Google) | URI de redirecionamento diferente | Passo 3.5: copie e cole a URI exata |
| "Acesso bloqueado: app em teste" | App não publicado | Passo 4 |
| Volta para o Prancheta com "Não deu para entrar" | Endereço do site fora da lista permitida (ex.: um link de *preview* da Vercel) | Use o domínio principal, ou peça para eu adicionar o endereço na lista |

## Domínio próprio no futuro

Se trocar `prancheta-two.vercel.app` por um domínio seu, avise: é preciso atualizar a URL do site no Supabase e
as origens no Google (passo 3.4).
