[Uploading INSTALL.md…]()
# Instalação — SEGESP-GM

Guia passo a passo para instalar o sistema do zero em um novo ambiente.

---

## Pré-requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari)
- Conta gratuita no [Supabase](https://supabase.com)
- Servidor local para rodar o app (Live Server, Python ou Node.js)

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta.
2. Clique em **New project**.
3. Preencha:
   - **Name:** `segesp-gm`
   - **Database Password:** escolha uma senha forte (anote)
   - **Region:** `South America (São Paulo)`
4. Aguarde ~2 minutos até o projeto ficar **Ready**.

---

## 2. Criar as tabelas no banco

1. No painel do Supabase, abra **SQL Editor** → **+ New query**.
2. Cole o conteúdo de `supabase/schema.sql`.
3. Clique em **Run**.
4. Verifique que aparece: **"Schema criado com sucesso!..."** e a contagem de registros (10 ciclos, 5 funções, etc.).
5. (Opcional) Cole o conteúdo de `supabase/seed.sql` e clique em **Run** novamente — só para garantir que os dados iniciais estão completos.

---

## 3. Criar o usuário administrador

1. No painel, clique em **Authentication** → **Users**.
2. Clique em **Add user** → **Create new user**.
3. Preencha:
   - **Email:** `admin@segesp-gm.com` (ou seu e-mail)
   - **Password:** uma senha forte (ex.: `Pinhais@2026`)
   - Marque **Auto Confirm User**
4. Clique em **Create user**.
5. Copie o **UID** do usuário criado (aparece na lista de usuários).

Agora insira na tabela `usuarios`:

1. Volte ao **SQL Editor** → **+ New query**.
2. Cole:
   ```sql
   insert into usuarios (id, nome, login, perfil, ativo)
   values ('<UID>', 'Administrador', 'admin@segesp-gm.com', 'ADMINISTRADOR', true);
   ```
3. Clique em **Run**.

---

## 4. Ativar as regras de acesso por perfil (RLS)

1. No **SQL Editor**, cole `supabase/rls_perfis.sql` e clique em **Run**.
2. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**.

---

## 5. Preparar o banco para guardar os dados do app (migração 002)

O app grava tudo no Supabase (o navegador guarda só uma cópia para abrir mais rápido).
No **SQL Editor**, cole `supabase/migracao_002.sql` e clique em **Run**. As instruções
estão no topo do arquivo; ele pode ser rodado de novo sem problema.

---

## 6. Criar os demais usuários

O login (e-mail e senha) é criado **no painel do Supabase**; o perfil é definido no app.

1. **Authentication → Users → Add user** (marque *Auto Confirm User*) e copie o **User UID**.
2. No app, como ADMINISTRADOR: **Configurações → Usuários e permissões → + Vincular login**,
   cole o User UID e escolha o perfil (ADMINISTRADOR, COMANDO, COORDENAÇÃO, SUPERVISÃO ou OPERACIONAL).
3. Quem não estiver nessa lista, ou estiver inativo, não consegue entrar.

---

## 7. Enviar os dados existentes (uma única vez)

Se algum navegador ainda guarda os dados da versão antiga (que ficavam só no aparelho):

1. Abra o app **nesse navegador**, entre como ADMINISTRADOR.
2. **Configurações → Migração única → Enviar dados deste navegador para o servidor**.
3. Confira o resumo (quantidade de registros por tabela). Depois você pode usar
   **Apagar cópia antiga deste navegador**, porque ela contém dados pessoais.

Os dados reais **não ficam no código nem no repositório**: só no Supabase.
