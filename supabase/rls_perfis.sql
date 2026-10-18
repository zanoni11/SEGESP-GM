-- SEGESP-GM — Políticas de acesso por perfil (RLS)
-- Já aplicado no banco em 18/10/2026. Pode ser rodado de novo sem problema.
-- Depois: Authentication → Sign In / Providers → desligar "Allow new users to sign up".

create or replace function public.meu_perfil()
returns text language sql stable security definer set search_path = public as $$
  select perfil from public.usuarios where id = auth.uid() and ativo = true
$$;

create or replace function public.tem_perfil(variadic perfis text[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_perfil() = any(perfis), false)
$$;

revoke all on function public.meu_perfil()          from public, anon;
revoke all on function public.tem_perfil(text[])    from public, anon;
grant execute on function public.meu_perfil()       to authenticated;
grant execute on function public.tem_perfil(text[]) to authenticated;

create or replace function pg_temp.aplicar(t text, escrita text[])
returns void language plpgsql as $$
declare p text;
begin
  execute format('alter table public.%I enable row level security', t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
    execute format('drop policy %I on public.%I', p, t);
  end loop;
  execute format('create policy %I on public.%I for select to authenticated using (public.meu_perfil() is not null)', 'ler_'||t, t);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.tem_perfil(variadic %L::text[]))', 'inserir_'||t, t, escrita);
  execute format('create policy %I on public.%I for update to authenticated using (public.tem_perfil(variadic %L::text[])) with check (public.tem_perfil(variadic %L::text[]))', 'alterar_'||t, t, escrita, escrita);
  execute format('create policy %I on public.%I for delete to authenticated using (public.tem_perfil(variadic %L::text[]))', 'excluir_'||t, t, escrita);
end $$;

select pg_temp.aplicar(t, array['ADMINISTRADOR','COMANDO','COORDENAÇÃO'])
from unnest(array['equipes','guardas','ancoras','horas_extras','ausencias','trocas','trocas_jornada','atividades','escalas_especiais']) t;

select pg_temp.aplicar(t, array['ADMINISTRADOR','COMANDO','COORDENAÇÃO','SUPERVISÃO'])
from unnest(array['supervisoes','comunicacoes']) t;

select pg_temp.aplicar(t, array['ADMINISTRADOR','COMANDO'])
from unnest(array['frota','setores','pontos_cp','tipos_bo','tipos_ra','tipos_vtr','destinatarios_ci']) t;

select pg_temp.aplicar(t, array['ADMINISTRADOR'])
from unnest(array['ciclos','funcoes','configuracoes']) t;

do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='usuarios' loop
    execute format('drop policy %I on public.usuarios', p);
  end loop;
end $$;
alter table public.usuarios enable row level security;
create policy ler_usuarios on public.usuarios for select to authenticated
  using (id = auth.uid() or public.tem_perfil('ADMINISTRADOR','COMANDO'));
create policy inserir_usuarios on public.usuarios for insert to authenticated with check (public.tem_perfil('ADMINISTRADOR'));
create policy alterar_usuarios on public.usuarios for update to authenticated
  using (public.tem_perfil('ADMINISTRADOR')) with check (public.tem_perfil('ADMINISTRADOR'));
create policy excluir_usuarios on public.usuarios for delete to authenticated using (public.tem_perfil('ADMINISTRADOR'));

do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='auditoria' loop
    execute format('drop policy %I on public.auditoria', p);
  end loop;
end $$;
alter table public.auditoria enable row level security;
create policy ler_auditoria on public.auditoria for select to authenticated using (public.tem_perfil('ADMINISTRADOR','COMANDO'));
create policy inserir_auditoria on public.auditoria for insert to authenticated
  with check (public.meu_perfil() is not null and user_id = auth.uid());

select pg_temp.aplicar('snapshots', array['ADMINISTRADOR']);
drop policy if exists ler_snapshots on public.snapshots;
create policy ler_snapshots on public.snapshots for select to authenticated using (public.tem_perfil('ADMINISTRADOR'));

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
