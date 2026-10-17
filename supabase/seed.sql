-- ============================================================
-- SEGESP-GM — Dados iniciais (seed)
-- ============================================================
-- Rode este arquivo DEPOIS do schema.sql.
-- Pode rodar múltiplas vezes (usa ON CONFLICT).
-- Útil para re-popular o banco sem recriar as tabelas.
-- ============================================================

-- Funções
insert into funcoes (id, nome, pode_supervisionar, fixa) values
  ('agente', 'Agente', false, true),
  ('supervisor', 'Supervisor', true, true),
  ('superintendente', 'Superintendente', true, false),
  ('coordenador', 'Coordenador', true, false),
  ('chefe_secao', 'Chefe de Seção', true, false)
on conflict (id) do nothing;

-- Ciclos
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

-- Tipos de B.O.
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

-- Tipos de R.A.
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

-- Tipos de viatura
insert into tipos_vtr (id, nome, ordem) values
  ('tvt_carro', 'Carro', 1),
  ('tvt_moto', 'Moto', 2),
  ('tvt_caminhonete', 'Caminhonete', 3),
  ('tvt_outro', 'Outro', 4)
on conflict (id) do nothing;

-- Destinatários de C.I.
insert into destinatarios_ci (id, nome, ordem) values
  ('dci_comando', 'Comando', 1),
  ('dci_coadm', 'Coordenação Administrativa (COADM)', 2)
on conflict (id) do nothing;

-- Feriados 2026
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

-- Verificação
select 'Seed aplicado com sucesso.' as resultado;
