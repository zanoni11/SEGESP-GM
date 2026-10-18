-- ============================================================
-- SEGESP-GM — Migração 002: dados do app passam a ficar no Supabase
-- ============================================================
-- COMO RODAR (uma vez, por quem administra o banco)
--   1. Abra o Supabase → SQL Editor → New query.
--   2. Cole TODO este arquivo e clique em Run.
--   3. Confira que não houve erro. O resultado mostra as 4 políticas da tabela
--      config_modulos (DELETE, INSERT, SELECT, UPDATE) e "tabelas_com_ordem" = 13.
--   4. Só depois publique/abra a versão nova do app.
--
-- PRÉ-REQUISITOS
--   - schema.sql e rls_perfis.sql já aplicados (as funções meu_perfil e tem_perfil
--     precisam existir).
--   - Pode rodar de novo sem problema (tudo é "if not exists" / "create or replace").
--   - Este arquivo NÃO apaga nem altera dados existentes.
--
-- O QUE MUDA
--   Comparando o state do app com o schema.sql, quase tudo já tinha onde ficar:
--     ancorasHist → ancoras | feriados, assinatura, logos, cabecalho, regrasEfetivo
--     → configuracoes | campos de guardas → guardas | trocas, atividades etc. → tabelas
--     próprias. O que faltava:
--       a) supervCfg (parâmetros da Supervisão): não tinha coluna.
--       b) ipm, requal, boletins e limitesExtras: tinham coluna em "configuracoes",
--          mas essa tabela só aceita escrita do ADMINISTRADOR (rls_perfis.sql), e
--          essas telas são editadas por COMANDO/COORDENAÇÃO. Com isso, qualquer
--          alteração delas seria recusada.
--   Solução: a tabela nova "config_modulos" (uma linha por módulo), com RLS no mesmo
--   padrão das demais (funções meu_perfil/tem_perfil):
--       leitura  → qualquer usuário ativo
--       escrita  → ipm e superv_cfg: ADMINISTRADOR e COMANDO
--                  (PERMISSOES do app: 'ipm.editar' e 'cadastros.supervisao')
--                  requal, boletins e limites_extras: ADMINISTRADOR, COMANDO e
--                  COORDENAÇÃO
--   As colunas ipm, requal, boletins e limites_extras de "configuracoes" deixam de ser
--   usadas pelo app (ficam no banco, sem efeito). "configuracoes" continua guardando
--   instituição, feriados, regras de efetivo, assinatura, logos e cabeçalho (só o
--   ADMINISTRADOR altera, como a tela de Configurações).
--
--   c) Ordem das listas: o app mostra equipes, guardas, ciclos etc. na ordem em que estão
--      na lista (a ordem das equipes, por exemplo, é a ordem de exibição). O banco não
--      guardava essa ordem, então as tabelas abaixo ganham a coluna "ordem" (posição na
--      lista). O app grava e usa essa coluna.
--
--   Também cria um índice para a consulta do registro de auditoria.
--
-- DEPOIS DE RODAR
--   No app (como ADMINISTRADOR): Configurações → "Enviar dados deste navegador para o
--   servidor", uma única vez, no navegador que tem os dados atuais.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela dos ajustes por módulo
-- ------------------------------------------------------------
create table if not exists public.config_modulos (
  id text primary key,                      -- 'ipm' | 'superv_cfg' | 'requal' | 'boletins' | 'limites_extras'
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Quem pode escrever em cada módulo
-- ------------------------------------------------------------
create or replace function public.perfis_modulo(modulo text)
returns text[] language sql immutable set search_path = public as $$
  select case
    when modulo in ('ipm', 'superv_cfg') then array['ADMINISTRADOR','COMANDO']
    else array['ADMINISTRADOR','COMANDO','COORDENAÇÃO']
  end
$$;

revoke all on function public.perfis_modulo(text) from public, anon;
grant execute on function public.perfis_modulo(text) to authenticated;

-- ------------------------------------------------------------
-- 3. RLS (mesmo padrão do rls_perfis.sql)
-- ------------------------------------------------------------
alter table public.config_modulos enable row level security;

do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'config_modulos' loop
    execute format('drop policy %I on public.config_modulos', p);
  end loop;
end $$;

create policy ler_config_modulos on public.config_modulos for select to authenticated
  using (public.meu_perfil() is not null);

create policy inserir_config_modulos on public.config_modulos for insert to authenticated
  with check (public.tem_perfil(variadic public.perfis_modulo(id)));

create policy alterar_config_modulos on public.config_modulos for update to authenticated
  using (public.tem_perfil(variadic public.perfis_modulo(id)))
  with check (public.tem_perfil(variadic public.perfis_modulo(id)));

create policy excluir_config_modulos on public.config_modulos for delete to authenticated
  using (public.tem_perfil(variadic public.perfis_modulo(id)));

revoke all on public.config_modulos from anon;

-- ------------------------------------------------------------
-- 4. Coluna "ordem" (posição da linha na lista do app)
-- ------------------------------------------------------------
alter table public.ciclos            add column if not exists ordem integer not null default 0;
alter table public.funcoes           add column if not exists ordem integer not null default 0;
alter table public.equipes           add column if not exists ordem integer not null default 0;
alter table public.guardas           add column if not exists ordem integer not null default 0;
alter table public.ancoras           add column if not exists ordem integer not null default 0;
alter table public.horas_extras      add column if not exists ordem integer not null default 0;
alter table public.ausencias         add column if not exists ordem integer not null default 0;
alter table public.trocas            add column if not exists ordem integer not null default 0;
alter table public.trocas_jornada    add column if not exists ordem integer not null default 0;
alter table public.atividades        add column if not exists ordem integer not null default 0;
alter table public.escalas_especiais add column if not exists ordem integer not null default 0;
alter table public.supervisoes       add column if not exists ordem integer not null default 0;
alter table public.comunicacoes      add column if not exists ordem integer not null default 0;

-- ------------------------------------------------------------
-- 5. Índice da auditoria (o app lê os 400 registros mais recentes)
-- ------------------------------------------------------------
create index if not exists idx_auditoria_em on public.auditoria (em desc);

-- ------------------------------------------------------------
-- 6. Conferência
-- ------------------------------------------------------------
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'config_modulos'
order by cmd;

select count(*) as tabelas_com_ordem
from information_schema.columns
where table_schema = 'public' and column_name = 'ordem'
  and table_name in ('ciclos','funcoes','equipes','guardas','ancoras','horas_extras','ausencias',
                     'trocas','trocas_jornada','atividades','escalas_especiais','supervisoes','comunicacoes');
