-- ============================================================
-- SEGESP-GM — Schema do banco de dados
-- ============================================================
-- Sistema de Escalas e Gestão Estratégica de Serviço Público
-- Guarda Municipal de Pinhais — PR
--
-- Este script:
--   - Cria as 21 tabelas do sistema
--   - Ativa Row Level Security (RLS) em todas
--   - Cria políticas de acesso para usuários autenticados
--   - Cria índices para performance
--   - Insere dados iniciais (ciclos, funções, feriados)
--
-- Como rodar: cole no SQL Editor do Supabase e clique em Run.
-- Pode rodar múltiplas vezes: usa IF NOT EXISTS e ON CONFLICT.
-- ============================================================

-- ============================================================
-- 1. LIMPEZA (permite re-rodar com segurança)
-- ============================================================
drop table if exists auditoria cascade;
drop table if exists usuarios cascade;
drop table if exists snapshots cascade;
drop table if exists configuracoes cascade;
drop table if exists escalas_especiais cascade;
drop table if exists destinatarios_ci cascade;
drop table if exists tipos_vtr cascade;
drop table if exists tipos_ra cascade;
drop table if exists tipos_bo cascade;
drop table if exists pontos_cp cascade;
drop table if exists setores cascade;
drop table if exists frota cascade;
drop table if exists comunicacoes cascade;
drop table if exists supervisoes cascade;
drop table if exists atividades cascade;
drop table if exists trocas_jornada cascade;
drop table if exists trocas cascade;
drop table if exists ausencias cascade;
drop table if exists horas_extras cascade;
drop table if exists funcoes cascade;
drop table if exists ancoras cascade;
drop table if exists guardas cascade;
drop table if exists equipes cascade;
drop table if exists ciclos cascade;

-- ============================================================
-- 2. CRIAÇÃO DAS TABELAS
-- ============================================================

-- 2.1. Ciclos (12x24, 12x12, expediente etc.)
create table ciclos (
  id text primary key,
  nome text not null,
  sequencia jsonb not null,
  horarios jsonb not null,
  folga_nos_feriados boolean default false,
  criado_em timestamptz default now()
);

-- 2.2. Equipes
create table equipes (
  id text primary key,
  nome text not null unique,
  ciclo_id text references ciclos(id) on delete set null,
  grupo text,
  exige_supervisor boolean default true,
  efetivo_minimo int default 4,
  chefia text,
  vinculo text,
  cor text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- 2.3. Guardas
create table guardas (
  id text primary key,
  nome_completo text not null,
  nome_guerra text,
  nome_edital text,
  matricula text unique,
  funcao text default 'agente',
  equipe_id text references equipes(id) on delete set null,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- 2.4. Âncoras (histórico de ciclos por equipe)
-- vigencia é TEXT porque o app usa '0000-01-01' como "sempre"
create table ancoras (
  id text primary key default gen_random_uuid()::text,
  equipe_id text references equipes(id) on delete cascade,
  data date not null,
  vigencia text not null default '0000-01-01',
  criado_em timestamptz default now()
);

-- 2.5. Funções (agente, supervisor, etc.)
create table funcoes (
  id text primary key,
  nome text not null,
  pode_supervisionar boolean default false,
  fixa boolean default false,
  criado_em timestamptz default now()
);

-- 2.6. Horas extras
create table horas_extras (
  id text primary key,
  data date not null,
  inicio text not null,
  fim text not null,
  horas numeric(5,2) not null,
  vagas int default 1,
  motivo text,
  escalados jsonb default '[]'::jsonb,
  criado_em timestamptz default now()
);

-- 2.7. Ausências
create table ausencias (
  id text primary key,
  guarda_id text references guardas(id) on delete cascade,
  tipo text not null,
  inicio date not null,
  fim date,
  obs text,
  criado_em timestamptz default now()
);

-- 2.8. Trocas de escala
create table trocas (
  id text primary key,
  guarda_a text references guardas(id) on delete cascade,
  data_a date not null,
  guarda_b text references guardas(id) on delete cascade,
  data_b date,
  obs text,
  entradas jsonb default '[]'::jsonb,
  criado_em timestamptz default now()
);

-- 2.9. Trocas de jornada
create table trocas_jornada (
  id text primary key,
  guarda_id text references guardas(id) on delete cascade,
  de date not null,
  para date not null,
  turno_novo text,
  turno_entrada text,
  obs text,
  atividade_id text,
  entrada jsonb default '{}'::jsonb,
  criado_em timestamptz default now()
);

-- 2.10. Atividades de requalificação
create table atividades (
  id text primary key,
  nome text not null,
  tipo text not null,
  inicio date not null,
  fim date not null,
  hora_ini text,
  hora_fim text,
  carga_h numeric(6,2),
  vagas int default 0,
  local text,
  obs text,
  retira boolean default true,
  conta boolean default true,
  status text default 'planejada',
  participantes jsonb default '[]'::jsonb,
  extras_sugeridas jsonb default '[]'::jsonb,
  criado_em timestamptz default now()
);

-- 2.11. Supervisões de dia
create table supervisoes (
  id text primary key,
  data date not null,
  turno text not null check (turno in ('D', 'N')),
  supervisor_id text references guardas(id) on delete set null,
  status text default 'aberto' check (status in ('aberto', 'fechado')),
  efetivo_previsto int default 0,
  efetivo_presente int default 0,
  observacoes text,
  data_hora_abertura timestamptz,
  data_hora_fechamento timestamptz,
  aberto_por text,
  fechado_por text,
  assinatura jsonb,
  efetivo jsonb,
  convocados jsonb default '[]'::jsonb,
  viaturas jsonb default '[]'::jsonb,
  bos jsonb default '[]'::jsonb,
  ras jsonb default '[]'::jsonb,
  cis jsonb default '[]'::jsonb,
  historico jsonb default '[]'::jsonb,
  criado_em timestamptz default now()
);

-- 2.12. Comunicações internas
create table comunicacoes (
  id text primary key,
  ano int not null,
  seq int not null,
  numero text not null,
  data date,
  assunto text,
  destinatario_id text,
  corpo text,
  assinatura jsonb,
  status text default 'Rascunho' check (status in ('Rascunho', 'Assinada')),
  supervisao_id text,
  criado_por text,
  criado_em timestamptz default now(),
  historico jsonb default '[]'::jsonb
);

-- 2.13. Viaturas (frota)
create table frota (
  id text primary key,
  nome text not null,
  tipo_id text,
  placa text,
  modelo text,
  obs text,
  status text default 'ativa',
  ativo boolean default true,
  ordem int default 0,
  criado_em timestamptz default now()
);

-- 2.14. Setores
create table setores (
  id text primary key,
  nome text not null,
  codigo text,
  descricao text,
  ativo boolean default true,
  ordem int default 0,
  criado_em timestamptz default now()
);

-- 2.15. Pontos do Cartão Programa
create table pontos_cp (
  id text primary key,
  nome text not null,
  local text,
  endereco text,
  setor_id text references setores(id) on delete set null,
  obs text,
  ativo boolean default true,
  ordem int default 0,
  criado_em timestamptz default now()
);

-- 2.16. Tipos auxiliares
create table tipos_bo (
  id text primary key,
  nome text not null,
  ativo boolean default true,
  ordem int default 0
);

create table tipos_ra (
  id text primary key,
  nome text not null,
  ativo boolean default true,
  ordem int default 0
);

create table tipos_vtr (
  id text primary key,
  nome text not null,
  ativo boolean default true,
  ordem int default 0
);

create table destinatarios_ci (
  id text primary key,
  nome text not null,
  ativo boolean default true,
  ordem int default 0
);

-- 2.17. Escalas especiais
create table escalas_especiais (
  id text primary key,
  nome text not null,
  ano int,
  ano_ant int,
  inicio date,
  fim date,
  natal jsonb,
  ano_novo jsonb,
  expediente jsonb,
  minimo jsonb,
  g jsonb default '{}'::jsonb,
  cob jsonb default '[]'::jsonb,
  criado timestamptz default now()
);

-- 2.18. Configurações (linha única)
create table configuracoes (
  id int primary key default 1,
  instituicao text default 'Guarda Municipal',
  feriados jsonb default '[]'::jsonb,
  limites_extras jsonb default '{}'::jsonb,
  regras_efetivo jsonb default '{}'::jsonb,
  assinatura jsonb default '{}'::jsonb,
  logos jsonb default '{}'::jsonb,
  cabecalho jsonb default '[]'::jsonb,
  requal jsonb default '{}'::jsonb,
  ipm jsonb default '{}'::jsonb,
  boletins jsonb default '{}'::jsonb,
  atualizado_em timestamptz default now(),
  constraint um_unico_id check (id = 1)
);
insert into configuracoes (id) values (1) on conflict do nothing;

-- 2.19. Usuários (vinculados ao Auth)
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  matricula text,
  login text unique not null,
  perfil text default 'OPERACIONAL',
  setor text,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 2.20. Auditoria
create table auditoria (
  id text primary key default gen_random_uuid()::text,
  em timestamptz default now(),
  por text,
  user_id uuid references auth.users(id) on delete set null,
  entidade text,
  ref text,
  acao text,
  detalhe text
);

-- 2.21. Snapshots (backup completo)
create table snapshots (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz default now(),
  criado_por uuid references auth.users(id) on delete set null,
  dados jsonb not null,
  tamanho_kb int,
  observacao text
);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

do $$ declare t text;
begin
  for t in select unnest(array[
    'ciclos','equipes','guardas','ancoras','funcoes','horas_extras',
    'ausencias','trocas','trocas_jornada','atividades','supervisoes',
    'comunicacoes','frota','setores','pontos_cp','tipos_bo','tipos_ra',
    'tipos_vtr','destinatarios_ci','escalas_especiais','configuracoes',
    'auditoria','snapshots','usuarios'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_all_%I" on %I', t, t);
    execute format('create policy "auth_all_%I" on %I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================
-- 4. ÍNDICES
-- ============================================================

create index idx_guardas_equipe on guardas(equipe_id);
create index idx_guardas_matricula on guardas(matricula);
create index idx_ancoras_equipe on ancoras(equipe_id);
create index idx_horas_extras_data on horas_extras(data);
create index idx_ausencias_guarda on ausencias(guarda_id);
create index idx_ausencias_periodo on ausencias(inicio, fim);
create index idx_trocas_data on trocas(data_a);
create index idx_trocas_jornada_guarda on trocas_jornada(guarda_id);
create index idx_atividades_inicio on atividades(inicio);
create index idx_supervisoes_data on supervisoes(data);
create index idx_snapshots_data on snapshots(criado_em desc);

-- ============================================================
-- 5. DADOS INICIAIS
-- ============================================================

-- 5.1. Funções
insert into funcoes (id, nome, pode_supervisionar, fixa) values
  ('agente', 'Agente', false, true),
  ('supervisor', 'Supervisor', true, true),
  ('superintendente', 'Superintendente', true, false),
  ('coordenador', 'Coordenador', true, false),
  ('chefe_secao', 'Chefe de Seção', true, false)
on conflict (id) do nothing;

-- 5.2. Ciclos
insert into ciclos (id, nome, sequencia, horarios, folga_nos_feriados) values
  ('c1', '12x24x12x72', '["D","N","F","F","F"]'::jsonb,
   '{"D":{"agente":["07:00","19:00"],"supervisor":["06:00","18:00"]},"N":{"agente":["19:00","07:00"],"supervisor":["18:00","06:00"]}}'::jsonb, false),
  ('c4', '12x12x12x84 (07h-19h)', '["D","D","F","F","F"]'::jsonb,
   '{"D":{"agente":["07:00","19:00"],"supervisor":["07:00","19:00"],"pausaMin":0},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, false),
  ('c5', 'ROMU 12x12x12x84 (14h-02h)', '["D","D","F","F","F"]'::jsonb,
   '{"D":{"agente":["14:00","02:00"],"supervisor":["14:00","02:00"],"pausaMin":0},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, false),
  ('c6', '12x24x12x72 Almoxarifado (06h30-18h30)', '["D","N","F","F","F"]'::jsonb,
   '{"D":{"agente":["06:30","18:30"],"supervisor":["06:30","18:30"],"pausaMin":0},"N":{"agente":["18:30","06:30"],"supervisor":["18:30","06:30"],"pausaMin":0}}'::jsonb, false),
  ('c7', '12x12x12x60 (07h-19h)', '["D","D","F","F"]'::jsonb,
   '{"D":{"agente":["07:00","19:00"],"supervisor":["07:00","19:00"],"pausaMin":0},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, false),
  ('c8', '12x12x12x60 Noturno (19h-07h)', '["N","N","F","F"]'::jsonb,
   '{"D":{"agente":["07:00","19:00"],"supervisor":["07:00","19:00"],"pausaMin":0},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, false),
  ('c9', '12x12x12x84 Noturno (19h-07h)', '["N","N","F","F","F"]'::jsonb,
   '{"D":{"agente":["07:00","19:00"],"supervisor":["07:00","19:00"],"pausaMin":0},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, false),
  ('c10', '10x14x10x86 (08h-18h)', '["D","D","F","F","F"]'::jsonb,
   '{"D":{"agente":["08:00","18:00"],"supervisor":["08:00","18:00"],"pausaMin":0},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, false),
  ('c11', 'Expediente 07h-16h (pausa 1h)', '["D","D","D","D","D","F","F"]'::jsonb,
   '{"D":{"agente":["07:00","16:00"],"supervisor":["07:00","16:00"],"pausaMin":60},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, true),
  ('c12', 'Expediente 08h-17h (pausa 1h)', '["D","D","D","D","D","F","F"]'::jsonb,
   '{"D":{"agente":["08:00","17:00"],"supervisor":["08:00","17:00"],"pausaMin":60},"N":{"agente":["19:00","07:00"],"supervisor":["19:00","07:00"],"pausaMin":0}}'::jsonb, true)
on conflict (id) do nothing;

-- 5.3. Tipos de B.O.
insert into tipos_bo (id, nome, ordem) values
  ('tbo_apoio', 'Apoio', 1),
  ('tbo_averiguacao', 'Averiguação', 2),
  ('tbo_ameaca', 'Ameaça', 3),
  ('tbo_furto', 'Furto', 4),
  ('tbo_roubo', 'Roubo', 5),
  ('tbo_perturbacao', 'Perturbação', 6),
  ('tbo_transito', 'Trânsito', 7),
  ('tbo_violencia_domestica', 'Violência doméstica', 8),
  ('tbo_acidente', 'Acidente', 9),
  ('tbo_patrulhamento', 'Patrulhamento', 10),
  ('tbo_outros', 'Outros', 11)
on conflict (id) do nothing;

-- 5.4. Tipos de R.A.
insert into tipos_ra (id, nome, ordem) values
  ('tra_queda_arvore', 'Queda de árvore', 1),
  ('tra_alagamento', 'Alagamento', 2),
  ('tra_enchente', 'Enchente', 3),
  ('tra_deslizamento', 'Deslizamento', 4),
  ('tra_risco_estrutural', 'Risco estrutural', 5),
  ('tra_destelhamento', 'Destelhamento', 6),
  ('tra_vistoria', 'Vistoria', 7),
  ('tra_apoio_defesa_civil', 'Apoio à Defesa Civil', 8),
  ('tra_outros', 'Outros', 9)
on conflict (id) do nothing;

-- 5.5. Tipos de viatura
insert into tipos_vtr (id, nome, ordem) values
  ('tvt_carro', 'Carro', 1),
  ('tvt_moto', 'Moto', 2),
  ('tvt_caminhonete', 'Caminhonete', 3),
  ('tvt_outro', 'Outro', 4)
on conflict (id) do nothing;

-- 5.6. Destinatários de C.I.
insert into destinatarios_ci (id, nome, ordem) values
  ('dci_comando', 'Comando', 1),
  ('dci_coadm', 'Coordenação Administrativa (COADM)', 2)
on conflict (id) do nothing;

-- 5.7. Feriados 2026
update configuracoes set feriados = '[
  {"data":"2026-01-01","nome":"Confraternização Universal"},
  {"data":"2026-04-03","nome":"Sexta-feira Santa"},
  {"data":"2026-04-21","nome":"Tiradentes"},
  {"data":"2026-05-01","nome":"Dia do Trabalho"},
  {"data":"2026-09-07","nome":"Independência do Brasil"},
  {"data":"2026-10-12","nome":"Nossa Senhora Aparecida"},
  {"data":"2026-11-02","nome":"Finados"},
  {"data":"2026-11-15","nome":"Proclamação da República"},
  {"data":"2026-11-20","nome":"Consciência Negra"},
  {"data":"2026-12-25","nome":"Natal"}
]'::jsonb where id = 1;

-- ============================================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================================
select 
  (select count(*) from ciclos) as ciclos,
  (select count(*) from funcoes) as funcoes,
  (select count(*) from tipos_bo) as tipos_bo,
  (select count(*) from tipos_ra) as tipos_ra,
  (select count(*) from tipos_vtr) as tipos_vtr,
  (select count(*) from destinatarios_ci) as destinatarios_ci,
  (select count(*) from configuracoes) as configuracoes;