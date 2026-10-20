# Mapa de implementação — SEGESP-GM

> **Natureza deste documento.** Mapa técnico de planejamento. Nada do que está descrito aqui foi implementado.
> Nenhum arquivo funcional, script SQL, política de acesso (RLS), credencial ou dado de produção foi alterado para produzi-lo;
> o único arquivo criado é este.
>
> **Convenção.** Cada afirmação vem marcada como **[FATO]** (verificado no repositório, com arquivo e linha/símbolo),
> **[RECOMENDAÇÃO]** (julgamento de quem escreve) ou **[DECISÃO PENDENTE]** (depende de quem coordena o projeto).
> Números de linha referem-se ao estado do repositório em 18/10/2026 (branch `claude/login-rls-policies-kt0b3l`, PR #4 aberto).
> Estimativas em dias são **juízo técnico**, não medição, e trazem as premissas na seção 12.

**Diretriz do projeto.** Melhorar Pinhais primeiro e preparar a arquitetura para uma possível expansão (consórcio de ~15 instituições,
nenhuma adesão confirmada), **sem ativar agora um sistema multi-instituição**. Sem novas dependências, frameworks ou etapa de build.

---

## Sumário

1. [Resumo executivo](#1-resumo-executivo)
2. [Diagnóstico da arquitetura atual](#2-diagnóstico-da-arquitetura-atual)
3. [Ausências encontradas](#3-ausências-encontradas)
4. [Quadro de sequência e dependências](#4-quadro-de-sequência-e-dependências)
5. [Fase A — implementar agora](#5-fase-a--implementar-agora)
   - [A1 — Perfil institucional centralizado](#a1--perfil-institucional-centralizado)
   - [A2 — Seed mínimo e seed de exemplo de Pinhais](#a2--seed-mínimo-e-seed-de-exemplo-de-pinhais)
   - [A3 — Schema idempotente e reset explícito](#a3--schema-idempotente-e-reset-explícito)
   - [A4 — Módulos opcionais](#a4--módulos-opcionais)
   - [A5 — Termos configuráveis](#a5--termos-configuráveis)
   - [A6 — Grupos de equipe com atributos](#a6--grupos-de-equipe-com-atributos)
6. [Fase B — decidir e preparar](#6-fase-b--decidir-e-preparar)
   - [B1 — `instituicao_id` com padrão `'pinhais'`](#b1--instituicao_id-com-padrão-pinhais)
   - [B2 — Vínculo de usuários à instituição](#b2--vínculo-de-usuários-à-instituição)
   - [B3 — CHANGELOG e sequência de migrations](#b3--changelog-e-sequência-de-migrations)
   - [B4 — Validação da instalação do zero](#b4--validação-da-instalação-do-zero)
7. [Decisões em aberto](#7-decisões-em-aberto)
8. [As cinco decisões prioritárias](#8-as-cinco-decisões-prioritárias)
9. [Divisão em PRs](#9-divisão-em-prs)
10. [Checklist de validação final](#10-checklist-de-validação-final)
11. [Testes: executados e pendentes](#11-testes-executados-e-pendentes)
12. [Estimativa total, premissas e incertezas](#12-estimativa-total-premissas-e-incertezas)

---

## 1. Resumo executivo

**Onde estamos.** [FATO] O SEGESP-GM é um aplicativo estático (um `index.html` de 6.889 linhas com o script inline, mais `supabase.js`,
`escala_especial.js`, `sw.js` e `manifest.webmanifest`), com Supabase/PostgreSQL como fonte de verdade e RLS por perfil.
Funciona bem para Pinhais, mas a identidade da instituição e a **estrutura organizacional** estão espalhadas pelo código:

- **Identidade**: "Escalas GM", "SEGESP-GM", "Guarda Municipal de Pinhais", "Pinhais" aparecem em ~33 pontos de 5 arquivos
  (26 em `index.html`), além de `readme.md`, `docs/*` e `supabase/schema.sql`. A instituição já é editável em **Configurações**
  (`state.instituicao`, `cabecalho`, `logos`, `assinatura`), mas isso cobre só parte dos textos.
- **Estrutura organizacional**: os nomes de grupo `'Operacional'`, `'PPC'`, `'ROMU'`, `'GTAM'`, `'COMON'`, `'Almoxarifado'`,
  `'Administrativo'`, `'Defesa Civil'`, `'Vigias'` e `'Patrulhas'` são **comparados como texto literal** em dezenas de lugares
  (contagem por linha em §A6) e decidem cálculo de efetivo, requalificação, supervisão, IPM e Escala Especial. Há ainda convenções
  escondidas em **nomes de equipe** (sufixo do nome liga Almoxarifado à equipe Operacional; prefixos `VIGIAS`/`PPC`/`COMON`; `/08H/`).
- **Banco**: `supabase/schema.sql` **começa apagando todas as tabelas** (`drop table … cascade`), embora o cabeçalho diga
  "pode rodar múltiplas vezes: usa IF NOT EXISTS". Rodá-lo em produção destruiria os dados. Não há reset explícito, seed separado
  do schema, nem controle de versão de migrations.

**O que o mapa propõe.** Seis frentes de implementação (A1–A6) e quatro de preparação/decisão (B1–B4), em **seis PRs** pequenos e
reversíveis. A ordem foi pensada para que **Pinhais não perceba nenhuma mudança de comportamento**: toda configuração nova tem como
padrão exatamente o que o código faz hoje.

**Recomendações centrais.**

1. **Perfil institucional em duas camadas**: padrões em arquivo (`config.js`, necessário antes do login, para PWA e tela de entrada)
   e personalização em banco (nova coluna JSONB em `configuracoes`, editável só pelo ADMINISTRADOR).
2. **Expansão por projeto Supabase separado por instituição** como caminho inicial; `instituicao_id` entra só como seguro, sem filtro nem RLS.
3. **Grupos como atributos**, nunca mais como nomes: o código passa a perguntar "este grupo tem o papel X?" em vez de "o grupo se chama 'ROMU'?".
4. **Schema idempotente sem `drop`**, `reset.sql` separado e explícito, migrations numeradas (`migracao_003.sql` em diante) com tabela de versão.
5. **Rede de segurança antes de refatorar A6**: teste de equivalência (golden master) com os dados fictícios de `testeExemplo()`.

**Esforço estimado:** 14 a 22 dias úteis de desenvolvimento, mais 20–30% de revisão e validação (§12).

---

## 2. Diagnóstico da arquitetura atual

### 2.1 Arquivos e responsabilidades

| Arquivo | Linhas | Papel | Observações [FATO] |
|---|---|---|---|
| `index.html` | 6.889 | Tela, estilos, lógica e módulos | Script inline único; `VERSAO_APP='2026.10.18.2'` (l. 216) |
| `supabase.js` | 219 | Módulo ES; expõe `window.sb` | URL do projeto fixa nas l. 18–19; chave `anon` (pública por desenho do Supabase) |
| `escala_especial.js` | 363 | Motor puro (UMD) da Escala Especial | Testado em Node (`tests/motor.test.js`) |
| `sw.js` | 45 | Service worker network-first | `CACHE='segesp-gm-2026.10.18-2'` (l. 7); lista `./escala_especial.js` |
| `manifest.webmanifest` | — | PWA | `name: "SEGESP-GM"`, descrição com "Guarda Municipal de Pinhais" |
| `supabase/schema.sql` | 495 | 24 tabelas, RLS permissiva, índices, seeds | Começa com 24 `drop table … cascade` (l. 21–44) |
| `supabase/rls_perfis.sql` | 77 | `meu_perfil()`, `tem_perfil()`, políticas por perfil | Idempotente (derruba e recria políticas) |
| `supabase/migracao_002.sql` | 134 | `config_modulos`, coluna `ordem`, índice | Idempotente (`if not exists`) |
| `supabase/seed.sql` | 99 | Funções, ciclos, tipos, destinatários | Duplica parte do `schema.sql` |
| `docs/INSTALL.md`, `DEPLOY.md`, `BACKUP`, `ESCALA_ESPECIAL.md` | — | Documentação | `BACKUP` não tem extensão |
| `readme.md` | 36 | Visão geral | **Grafia real é minúscula** (`readme.md`) |
| `tests/` | — | `motor.test.js` (Node), `e2e.escala_especial.js` (Playwright) | Dados fictícios |

### 2.2 Núcleo de estado e sincronização

- **`state`** é um objeto único normalizado por `normalizarEstado()` (l. 245). Padrões institucionais nascem ali:
  `s.instituicao = … || 'Guarda Municipal'` (l. 247) e `s.assinatura = { cargo: 'Coordenador Administrativo', cidade: 'Pinhais' }` (l. 374).
- **`TABS`** (l. 412) mapeia `state` ⇄ tabelas. Duas entradas são especiais: `configuracoes` (`tipo:'cfg'`, linha única) e
  `config_modulos` (`tipo:'mod'`, uma linha por módulo, chaves em `MODULOS`, l. 442).
- **`linhasDoEstado()`** (l. 472) e **`aplicarLinhas()`** (l. 486): a linha `cfg` lista **colunas explícitas**
  (`instituicao, feriados, regras_efetivo, assinatura, logos, cabecalho`). Qualquer coluna nova em `configuracoes` só será lida/gravada
  se for acrescentada nessas duas funções — ponto de atenção para A1 e A6.
- **`save()`** (l. 612) → `agendarSync()` (debounce 800 ms) → `sincronizar()` (l. 575) → diff por registro (`difEstado`, `estavel`).
  `lerServidor()` (l. 621) lê todas as tabelas de `TABS` em paralelo.
- **`ESCREVE`/`podeEscrever()`** (l. ~455) espelham o RLS no cliente; o servidor é quem decide.
- **Cache local**: `escalasGM.cache.v2` (`CACHE_KEY`, l. 400). Chaves legadas `escalasGM.pinhais.v1` só servem ao envio único.

### 2.3 Navegação e permissões

- `NAV` (l. 979, 16 telas), `NAV_GRUPOS` (l. 997), `NAV_PERM` (l. 1006), `renderNav()` (l. 1011), `aplicarRota()` (l. 1031).
  `render()` (l. 1078 aprox.) escolhe a função de tela por um mapa literal `{hoje: viewHoje, …}`.
- `renderNav` filtra por `podeVerTela(id)`; `aplicarRota` redireciona para `#/hoje` se a rota não existir **ou** o perfil não puder vê-la.
- `PERMISSOES` (l. 4372) e `can()`/`exigir()` (l. 4381–4385). Perfis em `PERFIS` (l. 238).

### 2.4 Acoplamentos institucionais (inventário)

**Identidade textual** [FATO — arquivo:linha]

| Onde | O que está fixo |
|---|---|
| `index.html:15, 181, 193, 203` | `<title>` e títulos "Escalas GM" |
| `index.html:6802–6805` | Tela de login: `img/brasao.png` (a pasta `img/` **não existe**; há `onerror` de contingência), `alt` e subtítulo "Guarda Municipal de Pinhais", `<h1>` "SEGESP-GM" |
| `index.html:247, 6523` | Padrão `'Guarda Municipal'` ao ler e ao salvar o nome da instituição |
| `index.html:374` | Assinatura: cargo "Coordenador Administrativo", cidade "Pinhais" |
| `index.html:3055` | `CAB_PADRAO = ['ESTADO DO PARANÁ','MUNICÍPIO DE PINHAIS','SUPERINTENDÊNCIA DA GUARDA MUNICIPAL']` |
| `index.html:3062–3064, 6541` | Rótulos de logo "Município de Pinhais"/"Guarda Municipal" (as **chaves** `municipio` e `gm` são gravadas no banco em `configuracoes.logos`) |
| `index.html:4876, 5312, 6240` | "Pinhais, <data>" em C.I., edital e boletim (fixo, não usa `assinatura.cidade`) |
| `index.html:4967` | Padrão 'Guarda Municipal de Pinhais' na Supervisão de Dia |
| `index.html:6275` | `testeExemplo()` ("Guarda Municipal (EXEMPLO FICTÍCIO)") — modo de teste |
| `index.html:6467` | `PRODID:-//Escalas GM//PT-BR//` e nome do calendário `.ics` |
| `index.html:7–11` | `theme-color` `#0e7490` e `apple-mobile-web-app-title` "SEGESP" |
| `manifest.webmanifest` | `name`, `short_name`, `description`, `theme_color` |
| `sw.js:7` | Nome do cache `segesp-gm-…` |
| `supabase.js:5, 18–19` | Comentário "Guarda Municipal de Pinhais — PR"; URL do projeto Supabase |
| `schema.sql` (cabeçalho, `configuracoes.instituicao default 'Guarda Municipal'`) | Texto e padrão |
| `docs/INSTALL.md:43–44, 55` | E-mail de exemplo `admin@segesp-gm.com` e senha de exemplo `Pinhais@2026` (padrão previsível; trocar por texto neutro) |
| `readme.md` | "Guarda Municipal de Pinhais", `github.com/seu-usuario/segesp-gm` (marcador não preenchido), "Time Netlify `segesp-gm`" |

**Estrutura organizacional** — contagem de **linhas** de `index.html` que contêm o literal entre aspas simples (método: `grep -c "'Nome'"`;
inclui usos que não são decisão de negócio, por isso é ordem de grandeza e não custo exato):

| Grupo | Linhas | Decide… [FATO — onde] |
|---|---:|---|
| `Operacional` | 22 | ciclo-base e horário-padrão (`index.html:3397, 4396`); supervisor diurno; efetivo (3413–3445); `eeEquipesRua` (5446); Escala Especial; IPM `dn` (5146) |
| `GTAM` | 22 | efetivo (`gtamMin`), unidade única "GTAM" na Escala Especial (5374, 5413), IPM `chefia` conjunto (5155), requal (4186) |
| `ROMU` | 16 | efetivo (`romuMin`), bloco `R:<nome>` (3689), IPM `romu`, EE |
| `PPC` | 15 | efetivo diurno, **pool de cobertura da Escala Especial** (`eePool`, 5472), IPM `chefia`, edital (3126) |
| `Almoxarifado` | 14 | ordem, IPM `almox`, edital; fora da Supervisão (4394); **pareado a uma equipe Operacional pelo sufixo do nome** (5373, 5412, 5448) |
| `Defesa Civil` | 10 | edital (3130, regex `/08H/`), IPM `exp`/`dias`, fora da Escala Especial na 1ª etapa (5540, 5985) |
| `COMON` | 9 | Central (3180), IPM `comon` com cabeçalho próprio (5152), EE `central` |
| `Vigias` | 8 | edital (regex `^VIGIAS`), IPM `dias`, fora da Escala Especial |
| `Administrativo` | 8 | expediente, fora da Supervisão (4394), IPM `exp` |
| `Patrulhas` | 4 | só no plano do IPM (5148, 5156) e em `IPMF_ORD` (5269) |

Listas de ordem paralelas, hoje independentes: `EE_ORD_GRUPO` (5407), `IPMF_ORD` (5269), `GRUPOS_RUA` (4186), `conhecidos` em `ipmPlano` (5156),
exclusões `['Administrativo','Almoxarifado']` em `supGrupos` (4394) e `salvarSuperv` (4685), `gruposFora` (5540, 5985–5997).

**Vocabulário "guarda"** [FATO] — em `index.html`, as formas `guarda/guardas/Guarda/Guardas/GUARDA(S)` somam cerca de 710 ocorrências
(`grep -o` com limite de palavra). **A maioria é identificador** (`state.guardas`, rota `guarda`, tabela `guardas`); quantas são rótulo visível **não foi medido**.

---

## 3. Ausências encontradas

[FATO] Verificado no repositório (`git ls-files`). Registradas aqui para não serem confundidas com arquivos que existam em outro lugar.

| Item pedido/esperado | Situação |
|---|---|
| `docs/ARQUITETURA-CONSORCIO.md` | **Não existe.** Este mapa não pôde se apoiar nele; as decisões de consórcio abaixo são recomendações novas |
| `CHANGELOG.md` | **Não existe** |
| `supabase/reset.sql` | **Não existe** (o "reset" está embutido no início do `schema.sql`) |
| `supabase/seed-exemplo-pinhais.sql` | **Não existe** |
| `supabase/migracao_003.sql` e `migracao_001.sql` | **Não existem.** A 001 nunca foi um arquivo (é o próprio `schema.sql`); a próxima da sequência é **003** |
| Objeto `CFG` / `config.js` | **Não existe** (`grep` por `CFG` não encontra nada) |
| Pasta `img/` (brasão) | **Não existe**; a tela de login tem contingência (`onerror`) |
| `README.md` (maiúsculo) | Não existe; o arquivo real é **`readme.md`** |
| Extensão em `docs/BACKUP` | Sem `.md` |
| Controle de versão do banco | **Inexistente** (nenhuma tabela ou comentário registra qual migration foi aplicada) |

Defeitos de documentação encontrados de passagem [FATO]:

- `docs/INSTALL.md` linha 1 contém o texto `[Uploading INSTALL.md…]()` e `docs/DEPLOY.md` linha 1 contém um link de anexo do GitHub — são restos de upload.
- Cabeçalho do `schema.sql` diz "21 tabelas" e "Pode rodar múltiplas vezes: usa IF NOT EXISTS e ON CONFLICT"; na realidade são **24** `create table`
  (25 com `config_modulos`) e o arquivo **apaga as tabelas**.
- `docs/INSTALL.md` (passo 2) cita a mensagem "Schema criado com sucesso!"; **ela não existe** em nenhum `.sql` (`grep`); o `schema.sql` termina com um `select count(*)` e o
  `seed.sql` com "Seed aplicado com sucesso.". A contagem "10 ciclos" confere com o seed; "5 funções" não foi conferida. Revisar na A3.
- `seed.sql` grava feriados com `update … set feriados = …` (sobrescreve); não é idempotente no sentido de preservar edições.
- `schema.sql` cria políticas permissivas `auth_all_*` (qualquer usuário autenticado lê e grava tudo); só `rls_perfis.sql` as substitui. Rodar o `schema.sql` depois do
  `rls_perfis.sql` em um banco que tivesse sobrado dados (se não houvesse o `drop`) **reabriria** o acesso. Hoje o `drop` impede isso... destruindo os dados.

---

## 4. Quadro de sequência e dependências

| Item | Depende de | Habilita | Toca em | Risco p/ Pinhais | Esforço (dias) |
|---|---|---|---|---|---:|
| **A1** Perfil institucional | — | A4, A5, B1 | `index.html`, `config.js` (novo), `manifest`, `sw.js`, migração 003 | Baixo | 2–3 |
| **A3** Schema idempotente + `reset.sql` | — | A2, B3, B4 | `supabase/*.sql`, docs | Médio (SQL; **não** roda em produção) | 1,5–2 |
| **A2** Seed mínimo + exemplo Pinhais | A3 | B4 | `supabase/seed*.sql`, docs | Baixo | 0,5–1 |
| **B3** CHANGELOG + sequência de migrations | A3 | B1, B2 | `CHANGELOG.md`, `supabase/`, docs | Baixo | 0,5–1 |
| **A4** Módulos opcionais | A1 | — | `index.html` | Baixo/Médio | 1,5–2 |
| **A5** Termos configuráveis | A1 | — | `index.html` | Baixo | 1,5–2 |
| **A6** Grupos com atributos | A1 (e teste de equivalência) | B-futuro | `index.html`, `escala_especial.js`? | **Alto** | 4–6 |
| **B1** `instituicao_id` | B3, A3 | B2 | migração 004, `index.html` (constante) | Médio (DDL em todas as tabelas) | 1–1,5 |
| **B2** Vínculo de usuários | B1 | — | migração 004, docs | Baixo | 0,5–1 |
| **B4** Instalação do zero | A3, A2, B3 | — | docs; ambiente isolado | Baixo | 1–2 |

**Caminho crítico:** A1 → A6. Os demais ramos (A3→A2→B3→B1→B2, e A4/A5) podem avançar em paralelo, desde que cada PR seja integrado na ordem da seção 9.

---

## 5. Fase A — implementar agora

> Regras válidas para **todos** os itens: JS puro/HTML/Tailwind via CDN; comentários, nomes e mensagens em português; preservar tabelas, colunas e
> contratos existentes (`state.guardas`, tabela `guardas`, `getGuarda`, rota `guarda`, chaves de logo `municipio`/`gm`); não alterar regra de negócio
> (escalas, efetivo, trocas, requalificação, IPM, Escala Especial) sem aprovação documentada; padrão novo = comportamento atual.

---

### A1 — Perfil institucional centralizado

**1. ID / título** — A1 · Perfil institucional centralizado (`CFG`).

**2. Problema atual** — A identidade está em ~33 pontos (§2.4). `normalizarEstado` (l. 247, 374), `CAB_PADRAO` (l. 3055), tela de login (l. 6802–6805),
`<title>`/títulos (l. 15, 181, 193, 203), `manifest.webmanifest`, `sw.js:7`. A cidade das assinaturas de C.I., edital e boletim é literal
(`'Pinhais, ' + dataExtenso(...)`, l. 4876, 5312, 6240) e ignora o campo "Cidade" que já existe em Configurações. Parte da identidade
**precisa existir antes do login** (título, tela de entrada, PWA); o banco não serve a esse trecho porque o RLS bloqueia leitura anônima.

**3. Proposta técnica** [RECOMENDAÇÃO] — **duas camadas**:

| Camada | Onde | Conteúdo | Quem edita |
|---|---|---|---|
| 1. Padrões e identidade de instalação | `config.js` (novo, carregado antes do script do app) → `window.CFG` | `id`, `nomeSistema`, `nomeCurto`, `orgao`, `unidadeSuperior`, `cidade`, `uf`, `brasao`, `cores`, `titulosDocumentos`, `siglas`, `termos`, `modulos`, `grupos` (padrões), `endereco`, `links` | Quem publica o sistema (arquivo versionado, **sem segredos**) |
| 2. Personalização | Nova coluna `perfil_institucional jsonb` em `configuracoes` (linha única) | Sobrescreve campos do `CFG` por instituição | **ADMINISTRADOR** (já é o único perfil com escrita em `configuracoes`, `rls_perfis.sql`) |

Por que não só arquivo: a instituição que adotar o sistema não deveria precisar editar código para trocar um cargo ou uma linha de cabeçalho; Pinhais
já edita nome, cabeçalho, logos e assinatura pelo app.
Por que não só banco: título da página, ícone, `manifest`, tela de login e `sw.js` são carregados **antes** da autenticação.
Por que coluna em `configuracoes` e não linha em `config_modulos`: `perfis_modulo()` (migracao_002.sql, l. 63–70) libera **qualquer id desconhecido**
para ADMINISTRADOR, COMANDO e COORDENAÇÃO; identidade institucional não deve ser editável por COORDENAÇÃO.

Resolução em tempo de execução: `perfil = merge(CFG, state.perfilInstitucional)`; função `inst(caminho, padrao)` lê o valor efetivo.
Os campos hoje separados (`state.instituicao`, `cabecalho`, `logos`, `assinatura`) **continuam sendo a fonte** do que já existe;
`CFG` só fornece o padrão quando vazios (preserva o dado atual de Pinhais).

`manifest.webmanifest` e `sw.js` são arquivos estáticos e **não leem `CFG`** (um JSON/worker não executa o `config.js` da página). Ficam com valores
neutros mantidos manualmente por instalação; o `index.html` ajusta `document.title` e `theme-color` em tempo de execução.

**Arquivo × banco — resumo da escolha**: arquivo para o que é necessário antes do login e para padrões; banco para o que o administrador da instituição ajusta.

**4. Arquivos afetados**
- Existentes: `index.html` (`normalizarEstado`, `TABS`/`linhasDoEstado`/`aplicarLinhas` na linha `cfg`, `renderNav`, cabeçalho/assinatura/ICS, login, `viewConfig`), `manifest.webmanifest`, `sw.js` (lista de arquivos), `docs/INSTALL.md`, `readme.md`.
- Novos: `config.js`, `supabase/migracao_003.sql` (coluna aditiva).

**5. Passo a passo**
1. Criar `config.js` com `window.CFG` preenchido **com os valores atuais de Pinhais** (nada muda na tela).
2. Incluir `<script src="config.js">` antes do script do app e `./config.js` em `ARQUIVOS` do `sw.js`; trocar `CACHE`.
3. Criar `inst(caminho, padrao)` e `perfil()` (merge `CFG` ← `state.perfilInstitucional`).
4. Substituir, um grupo de cada vez, os literais da tabela §2.4 (títulos, login, `CAB_PADRAO`, "Pinhais, …", ICS, padrão de `assinatura`).
5. `migracao_003.sql`: `alter table public.configuracoes add column if not exists perfil_institucional jsonb not null default '{}'::jsonb;`.
6. Acrescentar a coluna em `linhasDoEstado` (linha `cfg`) e `aplicarLinhas`; `normalizarEstado` valida e limita tamanho.
7. Tela **Configurações → Instituição** (agrupa nome, órgão, unidade superior, cidade/UF, cabeçalho, logos, assinatura, siglas, endereço, links). Visível só com `tela.config`; gravar só com `exigir('config.editar')` (ADMINISTRADOR, já coberto por `'*'`).
8. Testes: modo de teste (`?modo=teste`) e E2E existente.

**6. Antes → depois (ilustrativo)**

```js
// ANTES (index.html:374 e 5312)
s.assinatura = Object.assign({ nome: '', cargo: 'Coordenador Administrativo', cidade: 'Pinhais' }, ...);
${assinaturaHTML('Pinhais, ' + dataExtenso(new Date()))}

// DEPOIS
s.assinatura = Object.assign({ nome: '', cargo: inst('assinaturaCargo', 'Coordenador Administrativo'), cidade: inst('cidade', 'Pinhais') }, ...);
${assinaturaHTML(((state.assinatura || {}).cidade || inst('cidade', '')) + ', ' + dataExtenso(new Date()))}
```

```js
// config.js — padrão de Pinhais (sem segredos; sem credenciais; sem dados de pessoas)
window.CFG = {
  id: 'pinhais',
  nomeSistema: 'SEGESP-GM', nomeCurto: 'Escalas GM',
  orgao: 'Guarda Municipal de Pinhais', unidadeSuperior: 'Município de Pinhais',
  cidade: 'Pinhais', uf: 'PR', cores: { primaria: '#0e7490' },
  cabecalho: ['ESTADO DO PARANÁ', 'MUNICÍPIO DE PINHAIS', 'SUPERINTENDÊNCIA DA GUARDA MUNICIPAL'],
  /* termos, modulos e grupos entram em A5, A4 e A6 */
};
```

**7. Impacto para Pinhais** — Nenhum visível: todos os padrões reproduzem o texto atual. Único ganho visível: a cidade das assinaturas passa a obedecer à configuração.

**8. Risco / mitigação**
- *Ordem de carga*: `config.js` ausente ou com erro derruba o app. → `window.CFG = window.CFG || {}` no app e `inst()` sempre com padrão embutido.
- *Cache do service worker*: `config.js` velho. → entra na lista e o `CACHE` muda; já é network-first.
- *Chave de sincronização*: coluna nova fora de `linhasDoEstado` não grava. → critério de aceite abaixo.
- *Migração não aplicada*: o app já mostra diagnóstico de "migração pendente" (`classificarErro`, tipo `estrutura`); ajustar a mensagem para citar a 003.
- *Segurança*: `config.js` é público → proibido conter chaves de serviço ou dados pessoais (revisão em PR; `run_secret_scanning`).

**9. Critérios de aceite**
- Tela, PDFs, XLSX, ICS e login de Pinhais idênticos aos de hoje (comparação visual e dos textos).
- Alterar `perfil_institucional` em Configurações muda título, login (após recarregar), cabeçalho e assinatura; só ADMINISTRADOR consegue salvar (teste com perfil COORDENAÇÃO: recusado pelo servidor).
- Recarregar do servidor preserva os valores (round-trip da coluna nova).
- `grep` por "Pinhais" em `index.html` encontra apenas padrões dentro de `config.js` e dados fictícios de teste.

**10. Dependências / esforço** — Nenhuma dependência anterior. **2–3 dias** (a tela de edição e a revisão visual dos documentos pesam mais que o `config.js`).

---

### A2 — Seed mínimo e seed de exemplo de Pinhais

**1. ID / título** — A2 · `seed.sql` mínimo + `seed-exemplo-pinhais.sql` separado.

**2. Problema atual** — `schema.sql` (l. 397–485, seções 5.x) **embute** funções, ciclos, tipos de B.O./R.A./viatura, destinatários de C.I. e feriados de 2026;
`seed.sql` (99 linhas) repete esse conteúdo (funções, 10 ciclos `c1`, `c4`–`c12`, tipos, destinatários, feriados de 2026) [FATO].
Os ciclos incluem horários da realidade de Pinhais (ROMU 14h–02h, Almoxarifado 06h30–18h30, expedientes 07h–16h e 08h–17h) e há o destinatário
"Coordenação Administrativa (COADM)". Os feriados são gravados com **`update configuracoes set feriados = …`**, que **sobrescreve** a lista cada vez que o seed
roda (o cabeçalho do `seed.sql` diz que usa `ON CONFLICT`, mas esse trecho não usa) — rodar o seed em produção apagaria feriados que o administrador tenha cadastrado.
Não existe separação entre "mínimo para o sistema funcionar" e "exemplo de uma instituição".

**3. Proposta técnica** [RECOMENDAÇÃO]
- `seed.sql` (**mínimo e neutro**): funções fixas (`agente`, `supervisor`), um ciclo-padrão, tipos de viatura/B.O./R.A. genéricos, destinatário "Comando", linha única de `configuracoes`.
  Tudo com `on conflict do nothing`. **Sem feriados** (variam por município e ano; ficam para cadastro pelo administrador).
- `seed-exemplo-pinhais.sql` (**opcional, explícito**): ciclos, tipos e destinatários **atuais de Pinhais** e os feriados nacionais do ano. **Sem pessoas, sem matrículas,
  sem equipes reais** (a regra do PR #3 continua valendo).
- `schema.sql` deixa de conter dados; passa a conter só estrutura (ver A3).

**4. Arquivos afetados** — Existentes: `supabase/schema.sql`, `supabase/seed.sql`, `docs/INSTALL.md`, `readme.md`. Novos: `supabase/seed-exemplo-pinhais.sql`.

**5. Passo a passo**
1. Extrair as seções 5.x do `schema.sql` para dois conjuntos: neutro e exemplo.
2. Conferir, com `diff`, que **neutro ∪ exemplo = conteúdo atual** (nada se perde para Pinhais).
3. Fixar `id`s estáveis (os atuais), porque equipes/âncoras referenciam `ciclo_id`.
4. Atualizar `INSTALL.md` (passo 2: schema → seed mínimo; passo opcional: exemplo) e corrigir as contagens citadas.
5. Todos os `insert` com `on conflict (id) do nothing` — nunca `do update` (não sobrescrever o que o administrador editou). Os feriados do exemplo passam a ser
   gravados **só se a lista estiver vazia** (`update … where id = 1 and feriados = '[]'::jsonb`), em vez de sobrescrever.

**6. Antes → depois**
```sql
-- ANTES: schema.sql (l. ~397)  — dados dentro do schema
insert into funcoes (id, nome, pode_supervisionar, fixa) values (...);
-- DEPOIS: seed.sql (mínimo)    — idempotente e neutro
insert into funcoes (id, nome, pode_supervisionar, fixa) values
  ('agente','Agente',false,true), ('supervisor','Supervisor',true,true)
on conflict (id) do nothing;
```

**7. Impacto para Pinhais** — Nenhum no banco atual (nada é executado em produção). Quem reinstalar passa a ter a escolha entre mínimo e exemplo.

**8. Risco / mitigação** — Perder um ciclo que equipes reais usam. → `diff` de equivalência (passo 2) e IDs preservados. Rodar o exemplo em banco que já tem ciclos editados: `do nothing` evita sobrescrever.

**9. Critérios de aceite** — (a) schema + seed mínimo sobe um sistema que abre vazio e funcional; (b) + exemplo reproduz os ciclos/tipos atuais; (c) nenhum dado pessoal em nenhum seed (`grep` por matrícula/nome).

**10. Dependências / esforço** — Depende de **A3**. **0,5–1 dia**.

---

### A3 — Schema idempotente e reset explícito

**1. ID / título** — A3 · `schema.sql` sem `drop`; `reset.sql` explícito; documentação de migrations.

**2. Problema atual** [FATO] — `supabase/schema.sql:21–44` executa 24 `drop table if exists … cascade` antes de criar. O cabeçalho promete o contrário
("Pode rodar múltiplas vezes: usa IF NOT EXISTS e ON CONFLICT"). As tabelas são criadas com `create table` simples (l. 51+), e os índices com `create index`
(l. 380–390), ambos **sem** `if not exists`; o trecho de RLS permissivo (`auth_all_*`) é reaplicado. Efeitos:
(i) rodar o arquivo no banco de produção **apaga todos os dados**; (ii) após o `drop`, as políticas por perfil (`rls_perfis.sql`) desaparecem e as permissivas voltam
até que o `rls_perfis.sql` rode de novo.

**3. Proposta técnica** [RECOMENDAÇÃO]
- **Por que `IF NOT EXISTS` não basta**: ele só protege a criação da tabela. Não adiciona coluna nova a uma tabela que já existe (`create table if not exists` é ignorado
  quando a tabela existe, mesmo com colunas diferentes), não altera tipo, não cria índice/política nova. Evolução de estrutura exige **migrations** com
  `alter table … add column if not exists`, que é o padrão já usado em `migracao_002.sql`.
- `schema.sql` = **linha de base 001**: só `create table if not exists`, `create index if not exists`, `enable row level security`. **Sem `drop`, sem dados, sem política permissiva.**
  Tabela sem política com RLS ligado = acesso negado até `rls_perfis.sql` (mais seguro que o `auth_all_*` atual).
- `supabase/reset.sql` = os `drop table … cascade` movidos para cá, com guarda: um bloco `do $$ … $$` que **aborta** se `current_setting('segesp.confirmar_reset', true)` ≠ `'APAGAR-TUDO'`,
  mais cabeçalho em maiúsculas dizendo que é destrutivo e que nunca deve ser usado em produção.
- `migracao_002.sql` **não é mesclada** ao `schema.sql` (preserva a sequência 001 → 002 → 003… e o que já foi aplicado em produção).
- Ordem documentada de instalação: `schema.sql` → `rls_perfis.sql` → `migracao_002.sql` → `migracao_003.sql`… → `seed.sql` (→ `seed-exemplo-pinhais.sql`).

**4. Arquivos afetados** — Existente: `supabase/schema.sql`, `docs/INSTALL.md`, `readme.md`. Novo: `supabase/reset.sql`.

**5. Passo a passo**
1. Copiar os `drop` para `reset.sql` com a trava de confirmação.
2. Em `schema.sql`: `create table if not exists`, `create index if not exists`; remover seções de dados (→ A2) e o bloco `auth_all_*`.
3. Garantir que a estrutura resultante é **idêntica** à de produção hoje: comparar, num banco descartável, `schema.sql`(novo)+`rls_perfis`+`migracao_002` contra `schema.sql`(antigo)+`rls_perfis`+`migracao_002`
   (colunas, tipos, defaults, índices, políticas) — ver B4.
4. Corrigir cabeçalho (24 tabelas; "idempotente, sem apagar dados"), e o `INSTALL.md`.
5. Adicionar comentário no topo de `schema.sql`: "Para evoluir um banco existente, use as migrações; não altere este arquivo esperando que o banco mude".

**6. Antes → depois**
```sql
-- ANTES (schema.sql:21, 51)
drop table if exists auditoria cascade;  ...
create table ciclos ( ... );
-- DEPOIS (schema.sql)
create table if not exists ciclos ( ... );
-- DEPOIS (reset.sql)
do $$ begin
  if coalesce(current_setting('segesp.confirmar_reset', true), '') <> 'APAGAR-TUDO' then
    raise exception 'reset.sql apaga TODOS os dados. Defina: set segesp.confirmar_reset = ''APAGAR-TUDO'';';
  end if;
end $$;
drop table if exists auditoria cascade;  -- ...
```

**7. Impacto para Pinhais** — Nenhum no banco em uso. Benefício: acaba o risco de apagar produção por engano. **Esta mudança só altera arquivos `.sql` do repositório; não é executada em produção.**

**8. Risco / mitigação**
- *Divergência entre o novo `schema.sql` e o banco real* → comparação estrutural (passo 3).
- *Remover as políticas permissivas muda o estado de um banco recém-criado*: antes de `rls_perfis.sql` o acesso fica negado em vez de aberto. É mais seguro, mas **é mudança de segurança** → registrar no CHANGELOG e **exigir aprovação explícita** antes do merge.
- *Quem tem o hábito de rodar `schema.sql` para "limpar"* → `INSTALL.md` e o cabeçalho apontam `reset.sql`.

**9. Critérios de aceite** — (a) `schema.sql` roda duas vezes seguidas sem erro e sem alterar dados (insere-se um registro de teste entre as rodadas e confere-se que ele permanece); (b) `reset.sql` sem a variável aborta; com ela, apaga; (c) estrutura final idêntica à atual; (d) nenhum `drop` em `schema.sql` (`grep`).

**10. Dependências / esforço** — Independente. **1,5–2 dias** (a verificação estrutural é a maior parte).

---

### A4 — Módulos opcionais

**1. ID / título** — A4 · `CFG.modulos` (telas ligáveis/desligáveis).

**2. Problema atual** — `NAV` (l. 979) lista 16 telas fixas; `renderNav` (l. 1011) só filtra por `podeVerTela`; `aplicarRota` (l. 1031) idem; `render` (l. ~1078) tem o mapa literal de views.
Uma instituição sem Escala IPM, sem Escala Especial ou sem Requalificação veria telas inúteis.

**3. Proposta técnica** [RECOMENDAÇÃO]
- `CFG.modulos = { hoje:true, semana:true, mes:true, guarda:true, equipe:true, cadastros:true, config:true, extras:true, ocorr:true, efetivo:true, superv:true, frota:true, requal:true, docs:true, ipm:true, especial:true }` — padrão **tudo ligado** (Pinhais igual a hoje).
- **Núcleo não desligável**: `hoje, semana, mes, guarda, equipe, cadastros, config` (sem `config` o administrador não consegue religar nada → impossível "trancar" o sistema).
- Opcionais: `extras, ocorr, efetivo, superv, frota, requal, docs, ipm, especial`.
- Função `moduloAtivo(id)` = `núcleo` ou `inst('modulos.'+id, true) !== false`.
- Uso: `renderNav` (esconde), `aplicarRota` (rota de módulo desligado → `#/hoje`) e `ROTAS`.
- **Ocultar ≠ autorizar** [FATO de projeto]: `moduloAtivo` é apenas **mais um filtro de exibição**; nunca concede acesso. Quem decide é `can()`/`podeVerTela` e, no servidor, o RLS.
  Os dados dos módulos ocultos **continuam** em `TABS`, sincronizados e protegidos; desligar um módulo **não apaga nada**.
- Dependências entre módulos a tratar: `superv` ↔ rota `docsup` (pré-visualização); `efetivo` alimenta os **avisos** de afastamento/troca (`regrasEfetivo`, l. 3394) — o cálculo
  continua existindo, só some a tela; `requal` aparece na ficha do guarda e em `participaRequal`; `ipm`/`especial` dependem de equipes e ciclos. **A lista exata de blocos
  de outras telas que consomem um módulo (ex.: resumos em `viewHoje`) ainda não foi levantada** — é o primeiro passo da implementação, e cada bloco deve tolerar o módulo desligado.

**4. Arquivos afetados** — `index.html` (`NAV`, `ROTAS`, `renderNav`, `aplicarRota`, `viewConfig`, pontos de consumo), `config.js`.

**5. Passo a passo**
1. Levantar (grep nas views) todo bloco que embute dados de módulo opcional; listar na descrição do PR.
2. Criar `moduloAtivo`; aplicá-lo em `renderNav`, `aplicarRota`, `ROTAS`.
3. Proteger os blocos embutidos (retornar vazio se o módulo estiver desligado).
4. Seção "Módulos" em Configurações → Instituição, só com ADMINISTRADOR; gravação em `perfil_institucional.modulos` (A1).
5. Teste: desligar cada opcional, navegar por todas as telas e conferir ausência de erros no console; tentar abrir `#/ipm` direto.

**6. Antes → depois**
```js
// ANTES
const itens = g.ids.map(id => NAV.find(n => n.id === id)).filter(n => n && podeVerTela(n.id));
// DEPOIS
const itens = g.ids.map(id => NAV.find(n => n.id === id)).filter(n => n && moduloAtivo(n.id) && podeVerTela(n.id));
```
```js
// aplicarRota
if (!ROTAS.includes(v) || !moduloAtivo(v) || !podeVerTela(v)) { v = 'hoje'; ... }
```

**7. Impacto para Pinhais** — Nenhum: todos os módulos permanecem ligados por padrão.

**8. Risco / mitigação** — Tela quebrar por dado ausente de módulo oculto → passo 3 e teste de navegação completo. Alguém achar que "oculto" protege dado sensível → documentar no texto da tela: *"ocultar não restringe acesso"*.

**9. Critérios de aceite** — Com todos ligados, o app é idêntico; com qualquer combinação de opcionais desligados, não há erro de console, nenhum link morto e `#/<rota>` de módulo desligado cai em `#/hoje`; dados do módulo desligado seguem no banco e voltam intactos ao religar.

**10. Dependências / esforço** — Depende de **A1**. **1,5–2 dias**.

---

### A5 — Termos configuráveis

**1. ID / título** — A5 · `CFG.termos.guardaSingular` / `guardaPlural` (apenas rótulos).

**2. Problema atual** — O vocabulário "guarda" está em todo o texto visível ("Guardas", "Ficha do guarda", "Agentes"). Outras instituições podem usar "agente", "policial penal", "servidor" etc.

**3. Proposta técnica** [RECOMENDAÇÃO] — Somente **rótulos de interface e documentos**.
**Não** renomear: `state.guardas`, tabela `guardas`, `getGuarda`, rota `guarda`, ids `g-…`, colunas, funções JS, textos de auditoria **já gravados** (histórico não é reescrito).
- `CFG.termos = { guardaSingular:'guarda', guardaPlural:'guardas', guardaGenero:'m' }` (o gênero cobre "o/a", "nenhum/nenhuma", "todos/todas").
- Helper `T(chave, capitalizar)`; plural/singular, maiúscula inicial e caixa alta derivados.
- **Faseado** (as ~710 ocorrências são majoritariamente código): Fase 1 = menu lateral, títulos de tela, botões e cabeçalhos; Fase 2 = mensagens e `toast`; Fase 3 = documentos impressos e XLSX. Cada fase em commit próprio.

**4. Arquivos afetados** — `index.html`, `config.js`; (`escala_especial.js` tem 19 linhas com "guarda" — só mensagens do motor; decidir se entram na Fase 2).

**5. Passo a passo** — (1) Classificar as ocorrências em *identificador* × *rótulo* (script de apoio local, não versionado); (2) criar `T()`; (3) trocar rótulos da Fase 1; (4) testar com `guardaSingular:'agente'`; (5) repetir fases 2–3.

**6. Antes → depois**
```js
// ANTES
{ id: 'guarda', label: 'Guardas', icon: '👤' }
// DEPOIS (o id da rota NÃO muda)
{ id: 'guarda', label: () => T('guardaPlural', true), icon: '👤' }   // renderNav chama label() quando for função
```

**7. Impacto para Pinhais** — Nenhum com o padrão `guarda/guardas`.

**8. Risco / mitigação** — Concordância ("o guarda"/"a agente") → `guardaGenero`; frases montadas por concatenação ficam feias → revisar as 10–15 frases mais visíveis manualmente. Troca incompleta (mistura de termos) → ficar explícito na documentação que a Fase 1 cobre apenas a interface principal.

**9. Critérios de aceite** — Com `agente/agentes` aparece "Agentes" no menu, nos títulos e nos botões da Fase 1, sem erro; dados, URLs (`#/guarda`), exportações com **cabeçalhos de coluna técnicos** e importações (matrícula, colunas esperadas) continuam funcionando.

**10. Dependências / esforço** — Depende de **A1**. **1,5–2 dias** (Fase 1 sozinha: ~1 dia).

---

### A6 — Grupos de equipe com atributos

**1. ID / título** — A6 · Grupos de equipe definidos por atributos (papel e participação), não por nome.

**2. Problema atual** [FATO] — Ver tabela §2.4. Cada módulo decide por comparação de texto:
- Efetivo: `grupo('Operacional'|'PPC'|'ROMU'|'GTAM')` (l. 3413–3445) com regras próprias (`diurnoMin`, `romuMin`, `gtamMin`).
- Requalificação: `GRUPOS_RUA = ['Operacional','PPC','ROMU','GTAM']` (l. 4186); equipes fora via `foraRequal()` (4187) em `state.requal.fora`.
- Supervisão: `supGrupos()` (4394) exclui `Administrativo` e `Almoxarifado` por nome.
- IPM: `ipmPlano()` (5142) com um `eq('<grupo>', tipo)` por grupo + `conhecidos` (5156); `IPMF_ORD` (5269).
- Escala Especial: `EE_ORD_GRUPO` (5407), `eeEquipesRua` (5446: grupo `Operacional`), `eePool` (5472: grupo `PPC`), unidade `GTAM` (5374, 5413), pareamento Almoxarifado→Operacional **por sufixo do nome** (5373, 5412, 5448), `gruposFora` (5540: `Defesa Civil`, `Vigias`), mapa `{PPC:'ppc',ROMU:'romu',GTAM:'gtam',COMON:'central',Almoxarifado:'almox'}` (5660).
- Edital/boletim: `porGrupo('Almoxarifado'|'PPC'|'ROMU'|'Defesa Civil'|'Vigias', …)` (3125–3131) com regex em **nomes** (`/08H/`, `^VIGIAS`).
- `equipes.grupo` é **texto livre** (`schema.sql`, `grupo text`), sem lista de valores válidos; o campo no formulário tem `datalist`.

Consequência: uma instituição com "Rondas", "Patrulha Rural" ou "Maria da Penha" ficaria sem Efetivo, sem IPM correto e fora da Escala Especial, sem aviso.

**3. Proposta técnica** [RECOMENDAÇÃO]
- Nova estrutura `grupos` (padrões em `CFG.grupos`; personalização em coluna `grupos_equipe jsonb` de `configuracoes`, ADMINISTRADOR; ver decisão D4 sobre perfil que edita):

```js
{ nome: 'ROMU',            // identificador estável (o texto que já está em equipes.grupo)
  papel: 'rua',            // 'base' | 'rua' | 'apoio' | 'central' | 'expediente' | 'externo'
  ordem: 3,
  entraRequal: true, entraEfetivoDiurno: true, entraEfetivoNoturno: true,
  entraEscalaEspecial: true, entraIpm: true, tipoIpm: 'romu',    // 'dn'|'almox'|'romu'|'chefia'|'comon'|'exp'|'dias'
  pareiaCom: '',           // substitui a convenção do sufixo do nome (Almoxarifado→Operacional)
  entraSupervisao: true }
```
- `equipes.grupo` **continua sendo o nome do grupo** (nenhuma coluna de `equipes` muda, nenhuma migração em dados de equipe). A tabela de atributos é a única novidade.
- Funções de acesso: `grupoAttr(nome)`, `gruposComPapel('base')`, `gruposQue('entraRequal')`, `ordemGrupos()`. Grupo desconhecido recebe atributos **conservadores** (equivalentes ao tratamento atual dos "não conhecidos": entra no IPM como `exp`/`dias`; não entra em efetivo/EE) — **exatamente** o que `ipmPlano` já faz com `conhecidos`.
- Padrões de Pinhais **derivados da leitura do código** (a validar com a coordenação, ver D5):

| Grupo | papel | Requal | Efetivo D/N | Escala Especial | IPM (tipo) | Supervisão |
|---|---|:-:|:-:|:-:|---|:-:|
| Operacional | base | sim | sim/sim | sim | `dn` | sim |
| Almoxarifado | apoio (pareia com Operacional) | não* | não | sim (opção `almoxContaComoRua`) | `almox` | não |
| ROMU | rua | sim | sim | sim | `romu` | sim |
| PPC | rua | sim | sim (diurno) | sim (pool) | `chefia` | sim |
| GTAM | rua | sim | sim | sim (unidade única) | `chefia` conjunto | sim |
| COMON | central | — | não | sim (Central) | `comon` | sim |
| Defesa Civil | externo | — | não | fora na 1ª etapa | `exp` ou `dias` | sim |
| Vigias | externo | — | não | fora na 1ª etapa | `dias` | sim |
| Administrativo | expediente | — | não | fora (expediente) | `exp` | não |
| Patrulhas | expediente | — | não | — | `exp` | sim |

\* Almoxarifado entra em "todos" na requalificação mas não em "rua" (`GRUPOS_RUA`) — o atributo precisa distinguir **"rua"** de **"todos"**; ver passo 1.

- **Estratégia de segurança da refatoração**: *golden master*. Antes de mexer, gravar saídas de referência com `testeExemplo()` (equipes fictícias nos nove grupos):
  `ipmEscalaRows`, resultado do efetivo, `eeUnidades`/`eeAnalise`, HTML do edital, `supGrupos`. Depois da refatoração, as saídas devem ser **byte a byte iguais**.

**4. Arquivos afetados** — `index.html` (blocos citados), `config.js`, `supabase/migracao_003.sql` (coluna `grupos_equipe`, junto com a de A1), `tests/` (golden master; novo arquivo).
`escala_especial.js` **não deve precisar mudar** (motor puro recebe os dados já resolvidos).

**5. Passo a passo**
1. Inventário fechado: para cada uma das ~130 linhas com literal de grupo (§2.4), classificar em **decisão de regra** × **texto de exibição** × **ordem**. Resultado vai ao PR.
2. Escrever o golden master e confirmá-lo verde no código **atual**.
3. Criar `grupos` + funções de acesso; padrões = tabela acima.
4. Migrar **um módulo por commit**, rodando o golden master a cada commit, nesta ordem (do menos para o mais arriscado): ordem de exibição → Supervisão → Requal → IPM → Efetivo → edital/boletim → Escala Especial.
5. Trocar as convenções de nome por `pareiaCom` com **retrocompatibilidade**: se `pareiaCom` estiver vazio, manter a regra do sufixo (comportamento atual).
6. Tela **Configurações → Grupos de equipe** (só leitura do padrão + edição pelo ADMINISTRADOR); aviso quando uma equipe usa um grupo sem atributos.
7. Rodar `tests/motor.test.js` e `tests/e2e.escala_especial.js`.

**6. Antes → depois**
```js
// ANTES (index.html:4186, 4208)
const GRUPOS_RUA = ['Operacional', 'PPC', 'ROMU', 'GTAM'];
... modo === 'rua' && GRUPOS_RUA.includes(grupoDe(g))
// DEPOIS
const gruposRua = () => gruposQue('entraRequal').filter(n => grupoAttr(n).papel !== 'apoio');
... modo === 'rua' && gruposRua().includes(grupoDe(g))

// ANTES (index.html:5446, 5472)
const eeEquipesRua = () => state.equipes.filter(e => e.grupo === 'Operacional');
const eePool = ee => state.guardas.filter(g => eeEntra(ee, g) && eeHab(ee, g) && (getEquipe(g.equipeId) || {}).grupo === 'PPC');
// DEPOIS
const eeEquipesRua = () => state.equipes.filter(e => grupoAttr(e.grupo).papel === 'base');
const eePool = ee => state.guardas.filter(g => eeEntra(ee, g) && eeHab(ee, g) && grupoAttr(eeGrupoDe(g)).papel === 'rua' && grupoAttr(eeGrupoDe(g)).tipoIpm === 'chefia' /* PPC; definir atributo próprio "poolCobertura" */);
```
(O segundo exemplo mostra um achado: o *pool de cobertura* da Escala Especial é hoje "o grupo PPC" — precisa de **atributo próprio** `poolCobertura`, e não ser inferido de `papel`. Idem `unidadeUnica` para o GTAM. Esses atributos extras entram no passo 1.)

**7. Impacto para Pinhais** — Nenhum (golden master garante). Passa a poder criar um grupo novo sem tocar em código.

**8. Risco / mitigação** — *O mais alto do mapa.* Regressão silenciosa em cálculo de efetivo, IPM ou Escala Especial → golden master + um módulo por commit + padrões idênticos aos atuais. *Atributos mal configurados por outra instituição* → validação na tela (ex.: nenhum grupo com papel `base` ⇒ avisar que a Escala Especial não tem equipes de rua). *Dados reais fora do teste* → o golden master usa só `testeExemplo()`. *Regra de negócio*: **nenhuma regra muda**; se a leitura do código mostrar comportamento que a tabela acima não capte, **parar e levar à decisão D5**.

**9. Critérios de aceite** — (a) golden master idêntico; (b) `tests/motor.test.js` 37/37 e E2E verdes; (c) `grep "'Operacional'\|'ROMU'\|'PPC'\|'GTAM'\|'COMON'" index.html` só encontra `config.js`/dados de teste/padrões; (d) criar o grupo fictício "Rondas" com papel `rua` o faz entrar em Efetivo, IPM e Escala Especial conforme os atributos; (e) grupo sem atributos não quebra nenhuma tela.

**10. Dependências / esforço** — Depende de **A1** (e do golden master). **4–6 dias**; é o item de maior incerteza.

---

## 6. Fase B — decidir e preparar

### B1 — `instituicao_id` com padrão `'pinhais'`

**1. ID / título** — B1 · coluna `instituicao_id` em tabelas e no estado, **sem** isolamento.

**2. Problema atual** — Não existe noção de instituição no banco: 25 tabelas, nenhuma coluna de dono. Os `id` são texto (`'e1'`, UUID…) e chaves primárias **globais**.
`lerServidor` (l. 621) lê tudo; `sincronizar` grava tudo. Se uma segunda instituição entrasse no **mesmo** banco hoje, veria e alteraria os dados de Pinhais.

**3. Proposta técnica** [RECOMENDAÇÃO]
- **Caminho de expansão inicial: um projeto Supabase por instituição** (cada uma com seu `supabase.js`/`config.js`). Isolamento garantido pela infraestrutura, **zero risco de RLS**, nenhuma mudança de chave primária.
- `instituicao_id` entra apenas como **seguro**: `alter table … add column if not exists instituicao_id text not null default 'pinhais'` em cada tabela de dados (migração 004), mais índice nas tabelas grandes.
  Sem alterar PKs, sem filtrar leituras, **sem mudar RLS**.
- No app: `state.instituicaoId = CFG.id` (apenas leitura; ainda **não** filtra nem envia).
- Se um dia houver banco compartilhado (opção B, D1), será uma **migração própria**: chaves compostas, RLS por `instituicao_id`, filtro em `lerServidor`. Não é feito agora.
- Por que aditivo: o `default` preenche as linhas existentes e novas sem que o app (que não envia o campo) precise mudar; `TABS.cols` não muda.

**4. Arquivos** — Novo: `supabase/migracao_004.sql`. Existente: `index.html` (constante), `docs/`, `CHANGELOG.md`.

**5. Passo a passo** — (1) migração com `do $$ … foreach tabela` (mesmo padrão do laço sobre lista de tabelas do `schema.sql`, seção 3, e do `add column if not exists` de `migracao_002.sql` l. 103–115), `add column if not exists`; (2) conferir que `linhasDoEstado` **não** envia a coluna (para o `estavel` não detectar diferença espúria); (3) `CFG.id`; (4) documentar a decisão D1.

**6. Antes → depois**
```sql
-- migracao_004.sql (ilustrativo)
do $$ declare t text; begin
  foreach t in array array['ciclos','equipes','guardas', /* … todas as tabelas de dados … */ 'config_modulos'] loop
    execute format('alter table public.%I add column if not exists instituicao_id text not null default %L', t, 'pinhais');
  end loop;
end $$;
```

**7. Impacto para Pinhais** — Nenhum funcional. DDL em todas as tabelas (bloqueio rápido; volume pequeno).

**8. Risco / mitigação** — *`alter table … add column … default` em tabela com dados*: no PostgreSQL ≥ 11 com default constante é só metadado (rápido); ainda assim aplicar fora do horário de uso, com backup (`docs/BACKUP`). *Falsa sensação de isolamento* → texto explícito em `INSTALL.md`/CHANGELOG: **a coluna sozinha não isola ninguém**. *Colisão futura de `id`* → registrada como pré-requisito da opção B.

**9. Critérios de aceite** — Todas as tabelas com a coluna e valor `'pinhais'` nas linhas antigas; app inalterado (sincronização não gera diferenças); migração idempotente (segunda execução sem erro).

**10. Dependências / esforço** — Depende de **A3/B3**. **1–1,5 dia**.

### B2 — Vínculo de usuários à instituição

**1. ID / título** — B2 · como ligar usuário ↔ instituição.

**2. Problema atual** — `usuarios` (id uuid = `auth.users`, `perfil`, `ativo`, `setor`) não tem instituição. `meu_perfil()` devolve só o perfil.

**3. Proposta técnica** — Duas opções:

| Opção | Estrutura | Prós | Contras |
|---|---|---|---|
| **1 (recomendada)** | Coluna `instituicao_id text not null default 'pinhais'` em `usuarios` | Simples; já nasce com B1; cobre "1 usuário : 1 instituição" | Não atende quem atua em mais de uma instituição |
| 2 | Tabela `usuarios_instituicoes (usuario_id, instituicao_id, perfil)` | Atende vínculo múltiplo e perfil por instituição | Complexidade e mudança em `meu_perfil()`/RLS; sem demanda confirmada |

[RECOMENDAÇÃO] **Opção 1.** Só migrar para a 2 se houver caso real de usuário compartilhado entre instituições. Nenhuma mudança em `meu_perfil()`/RLS agora.

**4–5. Arquivos / passos** — Mesma `migracao_004.sql` (coluna em `usuarios`), tela de usuários exibe a instituição somente leitura. Sem alteração de login.

**6. Antes → depois** — `usuarios` ganha `instituicao_id`; nenhuma política muda.

**7. Impacto para Pinhais** — Nenhum.

**8. Risco** — Baixo; o risco real (acesso entre instituições) só existe em banco compartilhado, que **não será ativado**.

**9. Aceite** — Usuários existentes com `'pinhais'`; login e permissões idênticos.

**10. Dependências / esforço** — Depende de **B1**. **0,5–1 dia**.

### B3 — CHANGELOG e sequência de migrations

**1. ID / título** — B3 · `CHANGELOG.md` e convenção de migrations.

**2. Problema atual** [FATO] — Não há `CHANGELOG.md`. Existe `migracao_002.sql`, sem 001; o `schema.sql` já recebeu mudanças sem registro. `VERSAO_APP` (l. 216) e o `CACHE` de `sw.js` mudam à mão e **em dois lugares**.

**3. Proposta técnica** [RECOMENDAÇÃO]
- Numeração: **manter** `supabase/migracao_NNN.sql` (não renomear o que já existe). 001 = `schema.sql`; 002 existente; **003** = A1/A6 (colunas JSONB em `configuracoes`); **004** = B1/B2.
- Cada migração: cabeçalho padrão (objetivo, pré-requisitos, como rodar, o que **não** faz, como verificar), 100% idempotente, e **inserção em `public.versao_schema (versao int primary key, descricao text, aplicada_em timestamptz default now())`** com `on conflict do nothing`.
  A tabela é criada na 003. Leitura liberada a usuários ativos; sem escrita pelo app.
- `CHANGELOG.md` no formato *Keep a Changelog*, em português: `[Não lançado]`, versão (`2026.10.18.2` etc.), Adicionado/Alterado/Corrigido/Segurança, **e o que exige migração**.
- Regra de PR: toda mudança de estrutura traz migração + linha no CHANGELOG + atualização de `INSTALL.md`.
- Mostrar em Configurações → Dados: "Versão do app" e "Versão do banco" (lê `versao_schema`).

**4. Arquivos** — Novos: `CHANGELOG.md`. Existentes: `docs/INSTALL.md`, `readme.md`, `index.html` (mostrar versão do banco; opcional).

**5. Passos** — (1) criar `CHANGELOG.md` retroativo curto (PR #1 a #4, com datas dos merges); (2) convenção no `readme.md`; (3) `versao_schema` na 003.

**6. Antes → depois** — Sem registro → cada migração se auto-registra; o app consegue detectar "banco desatualizado" (hoje só detecta por erro de coluna inexistente, `classificarErro` tipo `estrutura`).

**7. Impacto para Pinhais** — Nenhum.

**8. Risco** — Documentação divergir do real → o CHANGELOG retroativo só cita o que consta no histórico do Git.

**9. Aceite** — Arquivo existe; 003 registra-se em `versao_schema`; `INSTALL.md` lista a sequência completa.

**10. Dependências / esforço** — Depende de **A3**. **0,5–1 dia**.

### B4 — Validação da instalação do zero

**1. ID / título** — B4 · prova de que o roteiro reinstala o sistema.

**2. Problema atual** — Nunca houve uma verificação formal de que `schema → rls_perfis → migracao_002 → …` produz um sistema funcional.

**3. Proposta técnica** — **Só executar** se houver (i) projeto Supabase **isolado e descartável** e (ii) autorização expressa. Sem isso, entregar o roteiro e marcá-lo **PENDENTE**.
Ambiente local aproximado (PostgreSQL com um esquema `auth` simulado) já foi usado neste repositório para testar RLS; **não substitui** o Supabase.

**Roteiro reproduzível (projeto descartável):**
1. Criar projeto Supabase novo (região São Paulo); anotar URL e chave `anon`.
2. SQL Editor: `schema.sql` → `rls_perfis.sql` → `migracao_002.sql` → `migracao_003.sql` → `migracao_004.sql` → `seed.sql` (→ `seed-exemplo-pinhais.sql`).
3. Rodar `schema.sql` **uma segunda vez**; confirmar que nada é apagado (inserir linha de teste antes).
4. Authentication: criar usuário; inserir em `usuarios` como ADMINISTRADOR; desligar "Allow new users to sign up".
5. Apontar uma cópia local do app para o projeto novo (`config.js`/`supabase.js` **locais, não commitados**).
6. Criar usuários de cada perfil e executar a matriz: o que cada perfil lê e grava (espelha `ESCREVE`).
7. Fluxos: criar equipe/guardas fictícios, gerar escala, registrar troca/afastamento, abrir/fechar Supervisão, Escala Especial, exportar.
8. Verificar com um usuário **anon** (sem login) que nenhuma tabela é legível.
9. Descartar o projeto.

**4–5.** Arquivos: `docs/INSTALL.md` (revisado com o resultado), `docs/VALIDACAO-INSTALACAO.md` (novo, com a tabela de resultados).

**6. Antes → depois** — "Funciona, mas ninguém confirmou" → tabela datada: passo, esperado, obtido, responsável.

**7. Impacto para Pinhais** — Nenhum (ambiente separado). **Proibido** apontar o teste para o banco de produção.

**8. Risco** — Rodar o teste no banco errado → `config.js` local com URL diferente, verificação visual do nome do projeto antes de qualquer `Run`.

**9. Aceite** — Todos os passos "obtido = esperado", ou desvios registrados e corrigidos.

**10. Dependências / esforço** — Depende de **A3, A2, B3** (e B1/B2 se já aplicadas). **1–2 dias**.

> **Status atual:** B4 **não foi executado**. Não há, nesta sessão, projeto Supabase descartável autorizado. O roteiro acima está **pendente**.

---

## 7. Decisões em aberto

| # | Decisão | Opções | Recomendação | Quem decide |
|---|---|---|---|---|
| D1 | Modelo de expansão | (A) um projeto Supabase por instituição; (B) banco compartilhado com RLS por `instituicao_id` | **A** agora; B só com adesões confirmadas e migração própria | Coordenação do projeto |
| D2 | Onde fica o perfil institucional | Só arquivo / só banco / duas camadas | **Duas camadas** (§A1) | Coordenação |
| D3 | Vínculo usuário↔instituição | Coluna em `usuarios` / tabela de ligação | **Coluna** (§B2) | Coordenação |
| D4 | Quem edita grupos e módulos | Só ADMINISTRADOR / também COMANDO | **ADMINISTRADOR** (afeta cálculo de escala; mesma regra de `ciclos` e `configuracoes`) | Comando de Pinhais |
| D5 | Padrões de grupo de Pinhais (tabela §A6) | Confirmar ou corrigir cada linha | Revisão pela coordenação **antes** do PR 3 | Coordenação operacional |
| D6 | Remover políticas `auth_all_*` do `schema.sql` (A3) | Remover (mais seguro) / manter | **Remover**, com aviso no CHANGELOG | Quem administra o banco |
| D7 | Termos: gênero gramatical | Campo `guardaGenero` / só substituição simples | **Campo** | Coordenação |
| D8 | Feriados no seed mínimo | Nenhum / nacionais do ano | **Nenhum** no mínimo; nacionais no exemplo | Coordenação |
| D9 | Teste de equivalência (golden master) em `tests/` | Versionar / só local | **Versionar** (dados fictícios) | Mantenedores |
| D10 | Endereço/links na tela de login | Exibir / não exibir | Não exibir por padrão | Coordenação |

---

## 8. As cinco decisões prioritárias

Em ordem; as duas primeiras desbloqueiam o PR 1 e o PR 4.

1. **D1 — Modelo de expansão.** Recomendo **um projeto Supabase por instituição**; `instituicao_id` só como seguro. Evita reescrever RLS e chaves primárias sem que exista uma adesão confirmada.
2. **D6 — Remover as políticas `auth_all_*` e o `drop` do `schema.sql`.** Elimina o risco de apagar/abrir o banco por engano. É mudança de segurança; precisa de aprovação explícita.
3. **D2 — Duas camadas para o perfil institucional** (arquivo + coluna em `configuracoes`).
4. **D5 — Confirmar a tabela de atributos dos grupos de Pinhais.** Sem isso A6 pode "formalizar" um comportamento que a coordenação não pretende.
5. **D4 — Quem pode editar grupos e módulos** (recomendo ADMINISTRADOR).

---

## 9. Divisão em PRs

Ajustada às dependências reais (B3 sobe para junto de A3, porque as colunas de B1/B2 são migrações e precisam da convenção definida antes).

| PR | Conteúdo | Depende de | Altera banco? | Risco | Esforço (dias) |
|---|---|---|---|---|---:|
| **PR 1** | **A1** Perfil institucional (`config.js`, tela Instituição, `migracao_003.sql` com `perfil_institucional` **e** `grupos_equipe`/`versao_schema`) | — | Sim (aditivo) | Baixo | 2–3 |
| **PR 2** | **A4 + A5** Módulos opcionais e termos | PR 1 | Não | Baixo/Médio | 3–4 |
| **PR 3** | **A6** Grupos com atributos (+ golden master) | PR 1; **D5** | Não (usa a coluna do PR 1) | **Alto** | 4–6 |
| **PR 4** | **A3 + A2 + B3** `schema.sql` idempotente, `reset.sql`, seeds, `CHANGELOG.md`, convenção de migrações | **D6** | Só arquivos `.sql` (não executados em produção) | Médio | 2,5–4 |
| **PR 5** | **B1 + B2** `migracao_004.sql` (`instituicao_id` em tabelas e `usuarios`) | PR 4, **D1/D3** | Sim (aditivo) | Médio | 1,5–2,5 |
| **PR 6** | **B4** Validação do zero + revisão final de `INSTALL.md`/`readme.md`/`DEPLOY.md` | PR 4, 5 | Não | Baixo | 1–2 |

Observações:
- PR 1 e PR 4 são independentes e podem andar em paralelo (equipes diferentes). PR 2 e PR 3 só começam após o PR 1.
- **Cada PR com migração** só é mesclado depois de a migração ser aplicada **primeiro** em ambiente de teste e, por quem administra, em produção **antes** de publicar o app que depende dela
  (o app já exibe diagnóstico de migração pendente).
- Os restos de upload em `INSTALL.md`/`DEPLOY.md` (linha 1) e o marcador `github.com/seu-usuario/segesp-gm` do `readme.md` entram no PR 4.

---

## 10. Checklist de validação final

- [ ] Pinhais: telas, PDFs, XLSX, `.ics`, login e PWA **idênticos** aos de antes (comparação visual e de texto).
- [ ] `node --test tests/motor.test.js` verde; `node tests/e2e.escala_especial.js` verde; golden master verde.
- [ ] Nenhuma regra de escala/efetivo/trocas/requalificação/IPM/Escala Especial alterada (revisão do diff).
- [ ] Nenhum dado pessoal em `config.js`, seeds ou testes; nenhuma credencial ou chave de serviço no repositório.
- [ ] RLS: perfis seguem com as mesmas permissões (matriz de §B4 passo 6); `anon` não lê nada.
- [ ] `schema.sql` roda duas vezes sem apagar dados; `reset.sql` exige confirmação.
- [ ] Migrações 003 e 004 idempotentes e registradas em `versao_schema`.
- [ ] `grep` por literais de grupo, por "Pinhais" e por "Guarda Municipal" só encontra `config.js`, dados fictícios de teste e documentação.
- [ ] Desligar cada módulo opcional não gera erro de console nem link morto; `#/<rota>` de módulo desligado cai em `#/hoje`.
- [ ] `VERSAO_APP`, `CACHE` do `sw.js` e `CHANGELOG.md` atualizados.
- [ ] `INSTALL.md`, `DEPLOY.md`, `readme.md` coerentes com a sequência real de instalação.
- [ ] Instalação do zero registrada em `docs/VALIDACAO-INSTALACAO.md`.

---

## 11. Testes: executados e pendentes

**Executados nesta tarefa** (somente leitura, sem alterar arquivos):
- `node --test tests/motor.test.js` → **37 testes, 37 aprovados, 0 falhas** (linha de base do motor da Escala Especial).

**Não executados** (e por quê):
- `tests/e2e.escala_especial.js` — exige Playwright/Chromium; não era necessário para um documento de planejamento.
- Qualquer SQL (`schema.sql`, `migracao_*.sql`, `seed*.sql`) — **proibido** contra produção e sem projeto descartável autorizado.
- Validação da instalação do zero (B4) — **pendente**.
- Contagens e classificações da §2.4 — feitas por leitura e `grep`; não há teste automatizado para elas.

**Pendentes de criação** (parte da implementação, não feitos): golden master (A6); teste de combinações de módulos (A4); teste de `T()` (A5); teste de idempotência do schema (A3).

---

## 12. Estimativa total, premissas e incertezas

| Item | Dias (mín–máx) |
|---|---:|
| A1 | 2–3 |
| A3 | 1,5–2 |
| A2 | 0,5–1 |
| B3 | 0,5–1 |
| A4 | 1,5–2 |
| A5 | 1,5–2 |
| A6 | 4–6 |
| B1 | 1–1,5 |
| B2 | 0,5–1 |
| B4 | 1–2 |
| **Total de desenvolvimento** | **14–21,5** |
| Revisão, correções de PR e validação (+20–30%) | +3–6 |
| **Total estimado** | **≈ 17–27 dias úteis** |

**Premissas** (juízo técnico, não medição): uma pessoa que já conhece o código; jornada produtiva de ~6 h/dia; sem espera por terceiros (decisões D1–D6 tomadas antes dos PRs 3–5);
um ambiente Supabase descartável disponível para B4; revisão de PR em até 1–2 dias por rodada.

**Incertezas principais**
1. **A6** (peso maior): o inventário linha a linha pode revelar regras implícitas que a tabela de atributos não captura (por exemplo, `pool de cobertura` e `unidade única` já apareceram durante este levantamento). Faixa realista: 4 a 8 dias.
2. **A4**: a lista de blocos de outras telas que consomem módulos opcionais **não foi levantada**; pode acrescentar 0,5–1 dia.
3. **A5**: o número de rótulos visíveis é desconhecido (as ~710 ocorrências são majoritariamente código); a Fase 1 é previsível, as Fases 2–3 não.
4. **B4**: depende de existir ambiente descartável; sem ele o item fica como roteiro.
5. Interferências externas: mudanças em andamento no PR #4 (Escala Especial) podem tocar `eeUnidades`, `eeEquipesRua`, `eePool` e `ipmPlano`, exigindo reconciliação com A6.

**O que este mapa não cobre:** ativação de multi-instituição, RLS por instituição, mudança de chaves primárias, migração de dados de produção, qualquer alteração de autenticação.
