/* ============================================================
   SEGESP-GM — Motor de regras da Escala Especial (recesso de fim de ano)
   ============================================================
   Funções puras: não usam o DOM, o `state` do app nem o Supabase. Recebem os dados e callbacks
   (turnoDe, aus, comp…) e devolvem resultados. O index.html monta esses dados a partir do state
   e mostra o resultado; os testes (tests/) chamam este arquivo direto, no Node.

   Datas sempre em texto ISO "AAAA-MM-DD". Turnos: 'D' (diurno), 'N' (noturno), 'F' (folga).
   Períodos do recesso: 'N' (Natal) e 'A' (Ano Novo).

   Nada aqui altera o ciclo habitual de ninguém: o recesso é calculado por cima do ciclo
   (turnoDe), apontando quais plantões do próprio ciclo são compensados.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EEMotor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- datas (UTC, sem problema de horário de verão) ---------- */
  const parse = k => { const [y, m, d] = String(k).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fmt = ms => new Date(ms).toISOString().slice(0, 10);
  const add = (k, n) => fmt(parse(k) + n * 864e5);
  const dif = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const intervalo = (a, b) => { const r = []; for (let k = a; k <= b; k = add(k, 1)) r.push(k); return r; };
  const DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dow = k => new Date(parse(k)).getUTCDay();
  const curto = k => k.slice(8, 10) + '/' + k.slice(5, 7);
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const ROTULO = { N: 'Natal', A: 'Ano Novo' };

  /* ---------- plantões do ciclo e bloco de folga ---------- */
  // Plantões (D/N) do ciclo habitual entre ini-antes e fim+depois
  function plantoes(turnoDe, ini, fim, antes, depois) {
    const r = [];
    for (let k = add(ini, -(antes == null ? 12 : antes)); k <= add(fim, depois == null ? 10 : depois); k = add(k, 1)) {
      const t = turnoDe(k); if (t === 'D' || t === 'N') r.push({ k, t });
    }
    return r;
  }
  // Folga contínua que resulta de compensar 3 plantões seguidos: do dia seguinte ao último plantão trabalhado
  // até o dia anterior ao primeiro plantão trabalhado depois. Os 3 plantões compensados e as folgas normais
  // do ciclo no meio formam o bloco.
  function bloco(S, comp) {
    if (!comp || comp.length !== 3) return null;
    const i = S.findIndex(s => s.k === comp[0]); if (i < 0) return null;
    const prev = S[i - 1], nxt = S[i + 3];
    const bs = prev ? add(prev.k, 1) : add(comp[0], -3), be = nxt ? add(nxt.k, -1) : null;
    const seguidas = !!(S[i + 1] && S[i + 1].k === comp[1] && S[i + 2] && S[i + 2].k === comp[2]);
    return { bs, be, len: be ? dif(bs, be) + 1 : null, ret: nxt ? nxt.k : null, ultimoAntes: prev ? prev.k : null, seguidas };
  }
  // Classifica cada dia do bloco: 'comp' (plantão compensado) ou 'folga' (folga normal do ciclo)
  function diasDoBloco(b, comp) {
    if (!b || !b.be) return [];
    return intervalo(b.bs, b.be).map(k => ({ k, tipo: comp.includes(k) ? 'comp' : 'folga' }));
  }

  /* ---------- validação do recesso de um guarda ---------- */
  // alvo: { dias: [datas do feriado], inicioComp, fim? }; cfg: { diasBloco }
  function validarBloco(S, comp, alvo, cfg) {
    const dB = (cfg && cfg.diasBloco) || 9, issues = [], erro = (cod, msg, regra) => issues.push({ cod, nivel: 'erro', msg, regra }), aviso = (cod, msg, regra) => issues.push({ cod, nivel: 'aviso', msg, regra });
    if (!comp || comp.length !== 3) { erro('sem_3', 'precisa de 3 escalas compensadas', 'três compensações de escala'); return issues; }
    const idx = comp.map(k => S.findIndex(s => s.k === k));
    if (idx.some(i => i < 0)) { erro('nao_plantao', 'há data que não é plantão deste guarda', 'compensar plantões do próprio ciclo'); return issues; }
    if (idx[1] !== idx[0] + 1 || idx[2] !== idx[0] + 2) erro('nao_seguidas', 'as 3 escalas não são seguidas no ciclo', 'três plantões seguidos do ciclo');
    if (alvo.inicioComp && comp[0] < alvo.inicioComp) erro('antes_inicio', 'começa antes de ' + curto(alvo.inicioComp), 'início do recesso configurado');
    const b = bloco(S, comp);
    if (b) {
      const p = alvo.dias[0], u = alvo.dias[alvo.dias.length - 1];
      if (!b.be) aviso('sem_retorno', 'não foi possível calcular a data de retorno (fora do período calculado)', 'data de retorno');
      else {
        if (b.len < dB) erro('bloco_curto', `a folga contínua tem ${b.len} dias (o recesso exige ${dB})`, `${dB} dias consecutivos sem serviço`);
        else if (b.len > dB) aviso('bloco_longo', `a folga contínua tem ${b.len} dias (acima de ${dB})`, `${dB} dias consecutivos sem serviço`);
        if (alvo.fim && b.be > alvo.fim) erro('apos_fim', 'a folga termina depois de ' + curto(alvo.fim), 'término do recesso configurado');
      }
      if (b.bs > p || (b.be && b.be < u)) erro('nao_cobre', 'a folga não cobre ' + alvo.dias.map(curto).join(' e '), 'cobrir os dias do feriado');
    }
    alvo.dias.forEach(k => { if (S.some(s => s.k === k) && !comp.includes(k)) erro('trabalha_feriado', 'trabalha em ' + curto(k), 'não trabalhar no feriado do grupo'); });
    return issues;
  }

  // Blocos possíveis (3 plantões seguidos) para o período; válidos primeiro, depois os de menor custo
  function candidatos(S, gr, alvo, cfg) {
    const lim = (cfg && cfg.janela && cfg.janela[gr]) || (gr === 'N' ? 8 : 6), dB = (cfg && cfg.diasBloco) || 9, out = [];
    for (let i = 0; i + 2 < S.length; i++) {
      const comp = [S[i].k, S[i + 1].k, S[i + 2].k];
      if (comp[0] < alvo.inicioComp || comp[0] > add(alvo.inicioComp, lim)) continue;
      const b = bloco(S, comp), prev = S[i - 1], nxt = S[i + 3];
      if (!b || b.bs > alvo.dias[0] || (b.be && b.be < alvo.dias[alvo.dias.length - 1])) continue;
      const issues = validarBloco(S, comp, alvo, cfg), valido = !issues.some(x => x.nivel === 'erro');
      const antes = Math.max(0, dif(b.bs, alvo.inicioComp));
      out.push({ gr, comp, bs: b.bs, be: b.be, len: b.len, ret: b.ret, valido, issues, prev: prev && prev.k, nxt: nxt && nxt.k,
        custo: (b.len ? Math.abs(b.len - dB) : 0) + (gr === 'N' ? 40 : 8) * antes + (valido ? 0 : 1000) });
    }
    return out.sort((a, b) => a.custo - b.custo || (a.comp[0] < b.comp[0] ? -1 : a.comp[0] > b.comp[0] ? 1 : 0));
  }

  // Inconsistência apresentada ao administrador (nunca "arrumada" em silêncio)
  function inconsistencia(g, per, issues, cands, alvo) {
    const erros = issues.filter(i => i.nivel === 'erro'); if (!erros.length) return null;
    const alt = cands.filter(c => c.valido).slice(0, 3).map(c => ({ tipo: 'bloco', texto: `${ROTULO[c.gr]}: compensar ${c.comp.map(curto).join(', ')} → folga ${curto(c.bs)} a ${c.be ? curto(c.be) : '?'} (${c.len} dias), retorno ${c.ret ? curto(c.ret) : '?'}`, bloco: c }));
    const outras = cands.filter(c => !c.valido).slice(0, 2).map(c => ({ tipo: 'bloco_incompleto', texto: `${ROTULO[c.gr]}: compensar ${c.comp.map(curto).join(', ')} → folga de ${c.len} dias (${c.issues.filter(x => x.nivel === 'erro').map(x => x.msg).join('; ')}) — só com decisão administrativa`, bloco: c }));
    const adm = [{ tipo: 'adm', texto: 'Autorizar um bloco com menos dias de folga, registrando a decisão' }, { tipo: 'adm', texto: 'Mudar o início do recesso desta equipe (19 ou 20 de dezembro) e recalcular' }, { tipo: 'adm', texto: 'Trocar o guarda para o outro período (Natal/Ano Novo), mantendo o equilíbrio da equipe' }];
    return { gid: g.id, nome: g.nome, matricula: g.matricula || '', equipe: g.equipe || '', periodo: per ? ROTULO[per] : '—', periodoCod: per || '',
      datas: { compensadas: g.comp || [], bloco: g.blocoCalc || null }, regras: erros.map(e => e.regra), problemas: erros.map(e => e.msg), alternativas: alt.concat(outras, adm) };
  }

  /* ---------- rodízio: divisão de cada equipe em Natal / Ano Novo ---------- */
  const chaveOrd = m => (m.matricula ? '0' + String(m.matricula).padStart(12, '0') : '1') + '|' + norm(m.nome) + '|' + String(m.id);
  const cmpOrd = (a, b) => (chaveOrd(a) < chaveOrd(b) ? -1 : chaveOrd(a) > chaveOrd(b) ? 1 : 0);
  // membros: [{id, nome, matricula, h:'N'|'A'|'', fixo, grupo}] — h = período que o guarda teve no ano anterior.
  // Regras: metades com diferença de no máximo 1; quem teve Natal vai para Ano Novo e vice-versa; sem histórico
  // completa o equilíbrio. Determinístico (mesmos dados = mesma proposta). Quando a inversão não cabe, o guarda
  // fica no outro período e a situação é SINALIZADA (alerta com alternativas), nunca silenciosa.
  function dividirUnidade(membros, ano) {
    const n = membros.length, ord = membros.slice().sort(cmpOrd), alertas = [];
    const querN = ord.filter(m => m.h === 'A').length, querA = ord.filter(m => m.h === 'N').length;
    let tN = Math.floor(n / 2), tA = tN;
    if (n % 2) { if (querN > querA) tN++; else if (querA > querN) tA++; else if (ano % 2 === 0) tN++; else tA++; }
    const cap = { N: tN, A: tA }, res = {};
    ord.filter(m => m.fixo && (m.grupo === 'N' || m.grupo === 'A')).forEach(m => { res[m.id] = m.grupo; cap[m.grupo]--; });
    const livres = ord.filter(m => !res[m.id]), exc = [];
    const tomar = (lista, g) => { const k = Math.max(0, cap[g]); lista.slice(0, k).forEach(m => { res[m.id] = g; }); cap[g] -= Math.min(k, lista.length); lista.slice(k).forEach(m => exc.push({ m, desejado: g })); };
    tomar(livres.filter(m => m.h === 'A'), 'N'); tomar(livres.filter(m => m.h === 'N'), 'A');
    exc.forEach(({ m, desejado }) => {   // inversão não coube: vai para o outro período e é sinalizado
      const outro = desejado === 'N' ? 'A' : 'N'; const g = cap[outro] > 0 ? outro : (cap[desejado] > 0 ? desejado : outro);
      res[m.id] = g; cap[g]--;
      if (g !== desejado) alertas.push({ cod: 'rodizio', gid: m.id, nome: m.nome, matricula: m.matricula || '', historico: m.h, desejado, atribuido: g,
        motivo: `a equipe tem mais guardas que precisam de ${ROTULO[desejado]} do que vagas (${desejado === 'N' ? tN : tA}); manter a divisão de ${tN}/${tA} obriga ${m.nome} a repetir ${ROTULO[m.h]}`,
        alternativas: ['Manter e registrar a exceção (decisão administrativa)', `Trocar com um colega da mesma equipe sem histórico ou que já esteja em ${ROTULO[g]}`, 'Aceitar uma diferença maior que 1 entre as metades desta equipe (autorização expressa)'] });
    });
    livres.filter(m => !res[m.id]).forEach(m => {   // sem histórico (ou h inválido): completa o equilíbrio
      const g = cap.N > cap.A ? 'N' : cap.A > cap.N ? 'A' : (Object.keys(res).length % 2 ? 'A' : 'N');
      res[m.id] = cap[g] > 0 ? g : (g === 'N' ? 'A' : 'N'); cap[res[m.id]]--;
    });
    const nN = ord.filter(m => res[m.id] === 'N').length, nA = n - nN;
    if (Math.abs(nN - nA) > 1) alertas.push({ cod: 'desbalanceio', nome: '', motivo: `grupos fixados à mão deixam a equipe com ${nN} no Natal e ${nA} no Ano Novo (diferença maior que 1)`, alternativas: ['Rever os grupos fixados', 'Aceitar a exceção, registrando a decisão'] });
    return { grupos: res, alvo: { N: tN, A: tA }, contagem: { N: nN, A: nA }, alertas };
  }

  /* ---------- importação do histórico (CSV / planilha) ---------- */
  function parseCSV(texto) {
    let t = String(texto || '').replace(/^﻿/, ''); if (!t.trim()) return [];
    const prim = t.split(/\r?\n/).find(l => l.trim()) || '';
    const cont = c => (prim.match(new RegExp(c === '\t' ? '\\t' : '\\' + c, 'g')) || []).length;
    const sep = [';', '\t', ','].sort((a, b) => cont(b) - cont(a))[0];
    const linhas = []; let lin = [], cel = '', asp = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (asp) { if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else asp = false; } else cel += c; }
      else if (c === '"') asp = true;
      else if (c === sep) { lin.push(cel); cel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; lin.push(cel); cel = ''; if (lin.some(x => x.trim() !== '')) linhas.push(lin.map(x => x.trim())); lin = []; }
      else cel += c;
    }
    lin.push(cel); if (lin.some(x => x.trim() !== '')) linhas.push(lin.map(x => x.trim()));
    return linhas;
  }
  const periodoDe = v => { const s = norm(v); if (!s || /^(sem|nao|nenhum|-|—|n\/a)/.test(s)) return ''; if (s.startsWith('natal')) return 'N'; if (/^(ano[ -]?novo|anonovo|reveillon|r[ée]veillon)/.test(s)) return 'A'; if (/^agend/.test(s)) return ''; return null; };
  // linhas: matriz (CSV/planilha). guardas: [{id, nome, matricula}]. Devolve a prévia, sem gravar nada.
  function validarHistorico(linhas, guardas, anoRef, existente) {
    const pc = c => { const s = norm(c); return /^matr/.test(s) ? 'mat' : /^(nome|servidor|guarda)/.test(s) ? 'nome' : /^(periodo|recesso|folga)/.test(s) ? 'per' : /^ano/.test(s) ? 'ano' : null; };
    let cols = { mat: 0, nome: 1, per: 2, ano: 3 }, ini = 0;
    if (linhas.length) { const m = linhas[0].map(pc); if (m.filter(Boolean).length >= 2) { cols = {}; m.forEach((c, i) => { if (c && cols[c] === undefined) cols[c] = i; }); ini = 1; }
      else if (linhas[0].length === 2 && !/^\d+$/.test(linhas[0][0].replace(/\D/g, '') || 'x')) cols = { nome: 0, per: 1 }; }
    const porMat = {}, porNome = {}; guardas.forEach(g => { if (g.matricula) (porMat[String(g.matricula).trim()] = porMat[String(g.matricula).trim()] || []).push(g); (porNome[norm(g.nome)] = porNome[norm(g.nome)] || []).push(g); });
    const vistos = {}, regs = linhas.slice(ini).map((c, i) => {
      const cel = k => (cols[k] === undefined ? '' : (c[cols[k]] || '')), mat = cel('mat').replace(/\s/g, ''), nome = cel('nome'), perTxt = cel('per'), anoTxt = cel('ano');
      const r = { linha: i + 1 + ini, matricula: mat, nome, periodoTxt: perTxt, ano: anoTxt ? parseInt(anoTxt, 10) : anoRef, periodo: periodoDe(perTxt), gid: '', status: 'ok', avisos: [], erros: [] };
      let g = null;
      if (mat) { const L = porMat[mat] || []; if (L.length === 1) g = L[0]; else if (L.length > 1) r.erros.push({ cod: 'matricula_duplicada', msg: `matrícula ${mat} está em mais de um guarda cadastrado` }); else r.erros.push({ cod: 'matricula_nao_encontrada', msg: `matrícula ${mat} não encontrada` }); }
      else if (nome) { const L = porNome[norm(nome)] || []; if (L.length === 1) { g = L[0]; r.avisos.push({ cod: 'sem_matricula', msg: 'sem matrícula: correspondência só pelo nome' }); } else r.erros.push({ cod: L.length ? 'nome_ambiguo' : 'nome_nao_encontrado', msg: L.length ? 'nome corresponde a mais de um guarda' : 'nome não encontrado' }); }
      else r.erros.push({ cod: 'sem_identificador', msg: 'linha sem matrícula nem nome' });
      if (g) { r.gid = g.id; if (nome && norm(nome) !== norm(g.nome) && mat && !norm(g.nome).includes(norm(nome)) && !norm(nome).includes(norm(g.nome))) r.avisos.push({ cod: 'nome_divergente', msg: `nome do arquivo (${nome}) difere do cadastro (${g.nome})` }); }
      if (r.periodo === null) r.erros.push({ cod: 'periodo_invalido', msg: `período inválido: "${perTxt}" (use Natal, Ano Novo ou "sem histórico")` });
      if (!(r.ano >= 1990 && r.ano <= 2200)) r.erros.push({ cod: 'ano_invalido', msg: `ano inválido: "${anoTxt}"` });
      else if (r.ano !== anoRef) r.erros.push({ cod: 'ano_diferente', msg: `ano ${r.ano} diferente do ano de referência (${anoRef})` });
      if (r.gid) { (vistos[r.gid] = vistos[r.gid] || []).push(r); }
      return r;
    });
    Object.keys(vistos).forEach(gid => { if (vistos[gid].length > 1) vistos[gid].forEach(r => r.erros.push({ cod: 'registro_duplicado', msg: 'guarda aparece mais de uma vez no arquivo' })); });
    regs.forEach(r => {
      if (r.gid && existente && existente[r.gid] !== undefined && existente[r.gid] !== '' && r.periodo !== null && (existente[r.gid] || '') !== (r.periodo || '')) r.avisos.push({ cod: 'conflito_existente', msg: `já existe ${ROTULO[existente[r.gid]] || 'registro'} cadastrado; o arquivo diz ${r.periodo ? ROTULO[r.periodo] : 'sem histórico'}` });
      r.status = r.erros.length ? 'erro' : r.avisos.some(a => a.cod === 'conflito_existente') ? 'conflito' : r.avisos.length ? 'aviso' : 'ok';
    });
    const impor = new Set(regs.filter(r => r.gid && !r.erros.length).map(r => r.gid));
    const semHist = guardas.filter(g => !impor.has(g.id) && !(existente && existente[g.id])).map(g => g.id);
    return { registros: regs, resumo: { total: regs.length, ok: regs.filter(r => r.status === 'ok').length, avisos: regs.filter(r => r.status === 'aviso').length, conflitos: regs.filter(r => r.status === 'conflito').length, erros: regs.filter(r => r.status === 'erro').length,
      matriculaNaoEncontrada: regs.filter(r => r.erros.some(e => e.cod === 'matricula_nao_encontrada')).length, duplicadas: regs.filter(r => r.erros.some(e => e.cod === 'matricula_duplicada' || e.cod === 'registro_duplicado')).length,
      periodoInvalido: regs.filter(r => r.erros.some(e => e.cod === 'periodo_invalido')).length, semHistorico: semHist.length }, semHistorico: semHist };
  }

  /* ---------- grade operacional ---------- */
  const PAPEL_ROT = { 'ppc-apoio': 'PPC (jornada ajustada)', 'sup-cobertura': 'Supervisor (cobertura)', 'sup-adjunto': 'Adjunto de supervisão', reforco: 'Reforço (almoxarifado)', 'gtam-rua': 'GTAM na equipe de rua', 'gtam-viatura': 'GTAM em viatura', 'gtam-motos': 'GTAM em motos', central: 'Central de Monitoramento', 'romu-comp': 'ROMU (composição)' };
  const OPPADRAO = () => ({ areaMin: { D: 4, N: 4 }, guardasPorVtr: 2, romu: { ideal: 3, excepcional: 2 }, gtam: { dupla: 2, trio: 3, min: 2 }, diasBloco: 9, almoxContaComoRua: false });

  // ctx: { dias, guardas:{id:{id,nome,matricula,funcao,eqId,eqNome,grupo,hab,adj,almox:{D,N}}}, equipes:{id:{id,nome,grupo,agIds,supIds}},
  //        rua:[eqId], linha:{ppc:[gid],romu:[gid],gtam:[gid],central:[gid],almox:[gid]}, turnoDe(gid,k), aus(gid,k), comp(gid,k), bloco(gid),
  //        cob:[], op:{...}, horario(gid,t) }
  function calcularGrade(ctx) {
    const op = Object.assign(OPPADRAO(), ctx.op || {}), G = ctx.guardas, E = ctx.equipes, cob = ctx.cob || [], nome = id => (G[id] ? G[id].nome : '?');
    const T = (id, k) => ctx.turnoDe(id, k) || '', hab = id => !G[id] || G[id].hab !== false;
    const sit = (id, k) => { const t = T(id, k); if (t === 'D' || t === 'N') return ctx.comp(id, k) ? 'recesso' : ctx.aus(id, k) ? 'afastado' : 'servico'; const b = ctx.bloco && ctx.bloco(id); return b && k >= b.bs && (!b.be || k <= b.be) ? 'folga_recesso' : 'folga'; };
    const auth = x => x.st !== 'proposta' && x.st !== 'negado';

    /* atribuições explícitas (quem foi colocado em outra função) */
    const atr = [];
    cob.forEach(c => { if (c.g && (c.tipo === 'ppc' || c.tipo === 'sup')) atr.push({ gid: c.g, k: c.k, t: c.t, papel: c.tipo === 'ppc' ? 'ppc-apoio' : 'sup-cobertura', eq: c.eq, st: c.st === 'proposta' ? 'proposta' : 'autorizado', ref: c.id, cob: c }); });
    Object.keys(op.subs || {}).forEach(key => { const s = op.subs[key]; if (s && s.adj) { const [k, t, eq] = key.split('|'); atr.push({ gid: s.adj, k, t, papel: 'sup-adjunto', eq, st: s.st || 'autorizado', ref: key, sub: s }); } });
    (op.reforcos || []).forEach(r => atr.push({ gid: r.g, k: r.k, t: r.t, papel: 'reforco', eq: r.eqDestino, st: r.st || 'autorizado', ref: r.id, reforco: r }));
    Object.keys((op.comp && op.comp.gtam) || {}).forEach(key => { const c = op.comp.gtam[key], [k, t] = key.split('|'); (c.ids || []).forEach(id => atr.push({ gid: id, k, t, papel: 'gtam-' + c.modo, eq: c.eqDestino || '', st: 'autorizado', ref: key, comp: c })); });
    Object.keys((op.comp && op.comp.romu) || {}).forEach(key => { const c = op.comp.romu[key], [k, t] = key.split('|'); (c.ids || []).forEach(id => atr.push({ gid: id, k, t, papel: 'romu-comp', st: 'autorizado', ref: key, comp: c })); });
    Object.keys(op.central || {}).forEach(k => { const c = op.central[k]; if (c && c.g) atr.push({ gid: c.g, k, t: '*', papel: 'central', st: c.st || 'autorizado', ref: k }); });
    const aut = atr.filter(a => auth(a));
    const emOutra = (id, k, t, ignorar) => aut.some(a => a.gid === id && a.k === k && (a.t === t || a.t === '*' || t === '*') && a.papel !== ignorar && !(a.papel.startsWith('gtam-') && ignorar === 'gtam') && !(a.papel === 'romu-comp' && ignorar === 'romu'));
    // quem, na base, pertence a uma linha mas foi deslocado por atribuição para OUTRA função
    const deslocado = (id, k, t, linha) => aut.some(a => a.gid === id && a.k === k && (a.t === t || a.t === '*') && !(linha === 'gtam' && a.papel.startsWith('gtam-') && a.papel !== 'gtam-rua') && !(linha === 'romu' && a.papel === 'romu-comp') && !(linha === 'central' && a.papel === 'central'));

    /* conflitos */
    const conflitos = [];
    const porSlot = {};
    atr.filter(a => a.st !== 'negado').forEach(a => { (porSlot[a.gid + '|' + a.k] = porSlot[a.gid + '|' + a.k] || []).push(a); });
    Object.keys(porSlot).forEach(key => {
      const L = porSlot[key]; if (L.length < 2) return;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j], mesmo = a.t === b.t || a.t === '*' || b.t === '*';
        const gtamJunto = a.papel.startsWith('gtam-') && b.papel.startsWith('gtam-') && a.ref === b.ref;
        if (!mesmo || gtamJunto) continue;
        conflitos.push({ cod: 'dupla_funcao', gid: a.gid, nome: nome(a.gid), k: a.k, t: a.t === '*' ? b.t : a.t, papeis: [PAPEL_ROT[a.papel] || a.papel, PAPEL_ROT[b.papel] || b.papel], msg: `${nome(a.gid)} está designado(a) em duas funções ao mesmo tempo em ${curto(a.k)}: ${PAPEL_ROT[a.papel] || a.papel} e ${PAPEL_ROT[b.papel] || b.papel}` });
      }
    });
    atr.filter(a => a.st !== 'negado' && a.papel !== 'reforco').forEach(a => {
      const s = sit(a.gid, a.k), t = a.t === '*' ? T(a.gid, a.k) : a.t, base = T(a.gid, a.k);
      if (s === 'recesso' || s === 'afastado') conflitos.push({ cod: 'indisponivel', gid: a.gid, nome: nome(a.gid), k: a.k, t: a.t, papeis: [PAPEL_ROT[a.papel] || a.papel], msg: `${nome(a.gid)} está ${s === 'recesso' ? 'em recesso (escala compensada)' : 'afastado(a)'} em ${curto(a.k)} e foi designado(a) como ${PAPEL_ROT[a.papel] || a.papel}` });
      if (a.papel === 'ppc-apoio' && t === 'N') {   // descanso: noite de apoio não pode emendar com serviço diurno no mesmo dia nem no dia seguinte
        const prox = add(a.k, 1), cobriuProx = cob.some(c => c.g === a.gid && c.k === prox && c.t === 'N');
        if (T(a.gid, prox) === 'D' && !ctx.comp(a.gid, prox) && !cobriuProx) conflitos.push({ cod: 'descanso', gid: a.gid, nome: nome(a.gid), k: a.k, t: 'N', papeis: [PAPEL_ROT[a.papel]], msg: `${nome(a.gid)} trabalharia a noite de ${curto(a.k)} e o dia ${curto(prox)} sem descanso de 12 horas` });
      }
      void base;
    });
    atr.filter(a => a.papel === 'sup-adjunto').forEach(a => { if (G[a.gid] && !G[a.gid].adj) conflitos.push({ cod: 'adjunto_nao_habilitado', gid: a.gid, nome: nome(a.gid), k: a.k, t: a.t, papeis: ['Adjunto de supervisão'], msg: `${nome(a.gid)} não está habilitado(a) como adjunto` }); });
    Object.keys((op.comp && op.comp.gtam) || {}).forEach(key => {
      const c = op.comp.gtam[key], [k, t] = key.split('|'), n = (c.ids || []).length, ok = c.modo === 'viatura' ? n === op.gtam.dupla : c.modo === 'motos' ? n === op.gtam.trio : c.modo === 'rua' ? n >= 1 : false;
      if (!ok) conflitos.push({ cod: 'gtam_composicao', gid: '', nome: '', k, t, papeis: ['GTAM'], msg: `GTAM ${curto(k)} ${t === 'D' ? 'diurno' : 'noturno'}: ${c.modo === 'viatura' ? 'viatura exige dupla' : c.modo === 'motos' ? 'motos exigem trio' : 'composição inválida'} (há ${n})` });
      (c.ids || []).forEach(id => { if (T(id, k) !== t) conflitos.push({ cod: 'gtam_fora_turno', gid: id, nome: nome(id), k, t, papeis: ['GTAM'], msg: `${nome(id)} não trabalha no turno informado em ${curto(k)}` }); });
    });

    /* linhas por data */
    const dias = [], deficits = [], pend = [];
    const fimJanela = ctx.dias[ctx.dias.length - 1];
    void fimJanela;
    ctx.dias.forEach(k => {
      const linhas = [];
      /* — Área (diurna / noturna) — */
      ['D', 'N'].forEach(t => {
        const equipes = (ctx.rua || []).map(id => E[id]).filter(e => e && e.agIds.some(id => T(id, k) === t));
        const pessoas = []; let previstos = 0, servico = 0, recesso = 0, afastados = 0, folga = 0; const folgaNomes = [];
        (ctx.rua || []).map(id => E[id]).filter(Boolean).forEach(e => {
          const ags = e.agIds.filter(hab);
          ags.forEach(id => { const s = sit(id, k), tt = T(id, k);
            if (tt === t) { previstos++;
              if (deslocado(id, k, t, 'area')) { pessoas.push({ gid: id, nome: nome(id), sit: 'remanejado_fora', eq: e.nome, obs: 'designado(a) em outra função' }); return; }
              if (s === 'servico') { servico++; pessoas.push({ gid: id, nome: nome(id), sit: 'servico', eq: e.nome }); }
              else if (s === 'recesso') { recesso++; pessoas.push({ gid: id, nome: nome(id), sit: 'recesso', eq: e.nome }); }
              else if (s === 'afastado') { afastados++; pessoas.push({ gid: id, nome: nome(id), sit: 'afastado', eq: e.nome }); } }
            else if (tt === 'F' && equipes.some(x => x.id === e.id)) { folga++; folgaNomes.push({ gid: id, nome: nome(id), sit: s }); } });
        });
        if (op.almoxContaComoRua) (ctx.linha.almox || []).forEach(id => { if (T(id, k) === t && hab(id)) { previstos++; const s = sit(id, k); if (s === 'servico') { servico++; pessoas.push({ gid: id, nome: nome(id), sit: 'servico', eq: 'Almoxarifado' }); } } });
        // remanejados autorizados para a área neste turno
        const rem = aut.filter(a => a.k === k && a.t === t && ['ppc-apoio', 'reforco', 'gtam-rua'].includes(a.papel));
        rem.forEach(a => pessoas.push({ gid: a.gid, nome: nome(a.gid), sit: 'remanejado', obs: PAPEL_ROT[a.papel], origem: a.papel, eq: a.eq && E[a.eq] ? E[a.eq].nome : '' }));
        const prop = atr.filter(a => a.st === 'proposta' && a.k === k && a.t === t && ['ppc-apoio', 'reforco'].includes(a.papel));
        const disponiveis = servico + rem.length, minimo = op.areaMin[t], faltam = Math.max(0, minimo - disponiveis);
        // possíveis reforços (não alocados automaticamente)
        const cand = [], usado = id => atr.some(a => a.st !== 'negado' && a.gid === id && a.k === k && (a.t === t || a.t === '*'));
        (ctx.linha.ppc || []).forEach(id => { if (!hab(id) || usado(id) || sit(id, k) !== 'servico') return; const tb = T(id, k);
          if (tb === 'D') cand.push({ gid: id, nome: nome(id), origem: 'PPC', obs: t === 'D' ? 'mesma jornada' : 'jornada diurna a ajustar para a noite (exige autorização)' });
          else if (tb === 'N' && t === 'N') cand.push({ gid: id, nome: nome(id), origem: 'PPC', obs: 'mesma jornada' }); });
        (ctx.linha.almox || []).forEach(id => { const g = G[id]; if (!g || usado(id) || !hab(id) || !g.almox || !g.almox[t] || (g.almox.datas && g.almox.datas.length && !g.almox.datas.includes(k))) return; const s = sit(id, k); if (s === 'recesso' || s === 'afastado') return;
          const tb = T(id, k); cand.push({ gid: id, nome: nome(id), origem: 'Almoxarifado', obs: tb === t ? 'escalado(a) no almoxarifado neste turno (autorizar o reforço)' : tb === 'F' ? 'em folga: o reforço seria serviço extra' : 'outro turno' }); });
        const restante = Math.max(0, faltam - cand.length);
        linhas.push({ id: `${k}|area|${t}`, k, linha: 'area', turno: t, titulo: t === 'D' ? 'Área diurna' : 'Área noturna', equipes: equipes.map(e => e.nome), eqIds: equipes.map(e => e.id), pessoas, folgaNomes, previstos, servico, recesso, afastados, folga, remanejados: rem.length, propostos: prop.length,
          disponiveis, minimo, faltam, vtrs: Math.floor(disponiveis / op.guardasPorVtr), candidatos: cand, restante, extraPotencial: restante, status: faltam > 0 ? 'deficit' : prop.length ? 'pendencia' : 'ok' });
      });
      /* — PPC — */
      if ((ctx.linha.ppc || []).length) {
        const pessoas = (ctx.linha.ppc || []).filter(hab).map(id => ({ gid: id, nome: nome(id), eq: G[id].eqNome, sit: sit(id, k), turnoBase: T(id, k), horario: ctx.horario ? ctx.horario(id, T(id, k)) : null })).filter(p => p.turnoBase === 'D' || p.turnoBase === 'N' || p.sit === 'folga_recesso');
        const ajustes = atr.filter(a => a.papel === 'ppc-apoio' && a.k === k).map(a => ({ gid: a.gid, nome: nome(a.gid), st: a.st, eq: a.eq && E[a.eq] ? E[a.eq].nome : '', turno: a.t, original: T(a.gid, k), horarioOriginal: ctx.horario ? ctx.horario(a.gid, T(a.gid, k)) : null, horarioProposto: ctx.horario ? ctx.horario(a.gid, a.t, true) : null,
          conflitos: conflitos.filter(c => c.gid === a.gid && c.k === k).map(c => c.msg), ref: a.ref, impacto: 'cobre 1 vaga da área ' + (a.t === 'D' ? 'diurna' : 'noturna') }));
        const disp = pessoas.filter(p => p.sit === 'servico').length;
        linhas.push({ id: `${k}|ppc|*`, k, linha: 'ppc', turno: '*', titulo: 'PPC', pessoas, previstos: pessoas.filter(p => p.turnoBase === 'D' || p.turnoBase === 'N').length, disponiveis: disp, recesso: pessoas.filter(p => p.sit === 'recesso').length, ajustes,
          status: ajustes.some(a => a.st === 'proposta' || a.conflitos.length) ? 'pendencia' : 'ok' });
      }
      /* — ROMU e GTAM — */
      [['romu', 'ROMU'], ['gtam', 'GTAM']].forEach(([lk, rot]) => {
        const mem = (ctx.linha[lk] || []).filter(hab); if (!mem.length) return;
        ['D', 'N'].forEach(t => {
          const doTurno = mem.filter(id => T(id, k) === t); if (!doTurno.length) return;
          const pessoas = doTurno.map(id => { const s = sit(id, k), des = deslocado(id, k, t, lk); return { gid: id, nome: nome(id), eq: G[id].eqNome, sit: des && s === 'servico' ? 'remanejado_fora' : s, obs: des ? 'designado(a) em outra função' : '' }; });
          const servico = pessoas.filter(p => p.sit === 'servico').length;
          if (lk === 'romu') {
            const comp = op.comp && op.comp.romu && op.comp.romu[k + '|' + t], emp = comp && comp.ids ? comp.ids.filter(id => pessoas.some(p => p.gid === id && p.sit === 'servico')).length : servico;
            const minimo = op.romu.excepcional, faltam = Math.max(0, minimo - emp), abaixoIdeal = emp < op.romu.ideal;
            linhas.push({ id: `${k}|romu|${t}`, k, linha: 'romu', turno: t, titulo: 'ROMU ' + (t === 'D' ? 'diurno' : 'noturno'), pessoas, previstos: doTurno.length, servico, disponiveis: emp, recesso: pessoas.filter(p => p.sit === 'recesso').length, minimo, ideal: op.romu.ideal, faltam, excepcional: faltam === 0 && abaixoIdeal,
              composicao: comp ? comp.ids : null, candidatos: [], restante: faltam, extraPotencial: faltam, status: faltam > 0 ? 'deficit' : abaixoIdeal ? 'pendencia' : 'ok', obs: faltam === 0 && abaixoIdeal ? `atuação excepcional com ${emp} (ideal ${op.romu.ideal})` : '' });
          } else {
            const comp = op.comp && op.comp.gtam && op.comp.gtam[k + '|' + t], minimo = op.gtam.min, disp = servico, faltam = Math.max(0, minimo - disp);
            const sug = servico >= op.gtam.trio ? 'motos' : servico >= op.gtam.dupla ? 'viatura' : servico === 1 ? 'rua' : '';
            linhas.push({ id: `${k}|gtam|${t}`, k, linha: 'gtam', turno: t, titulo: 'GTAM ' + (t === 'D' ? 'diurno' : 'noturno'), pessoas, previstos: doTurno.length, servico, disponiveis: disp, recesso: pessoas.filter(p => p.sit === 'recesso').length, minimo, faltam,
              composicao: comp || null, sugestao: sug, equipesPossiveis: comp ? (comp.modo === 'rua' ? 0 : 1) : (sug === 'rua' || !sug ? 0 : 1), candidatos: [], restante: faltam, extraPotencial: faltam, status: faltam > 0 ? 'deficit' : 'ok' });
          }
        });
      });
      /* — Supervisão (separada das VTRs da área) — */
      ['D', 'N'].forEach(t => {
        (ctx.rua || []).map(id => E[id]).filter(Boolean).forEach(e => {
          const tit = e.supIds[0]; if (!tit || T(tit, k) !== t) return;
          const s = sit(tit, k), subs = (op.subs || {})[`${k}|${t}|${e.id}`], cs = cob.find(c => c.tipo === 'sup' && c.eq === e.id && c.k === k && c.t === t);
          const cobertoPor = subs && subs.adj && auth(subs) ? { tipo: 'adjunto', gid: subs.adj, motivo: subs.motivo || '' } : cs && cs.g && cs.st !== 'proposta' ? { tipo: 'outro_supervisor', gid: cs.g } : null;
          const prop = (subs && subs.adj && subs.st === 'proposta') || (cs && cs.g && cs.st === 'proposta');
          const ocupado = id => atr.some(a => a.st !== 'negado' && a.gid === id && a.k === k && (a.t === t || a.t === '*'));
          const cand = [];
          if (s !== 'servico') {
            Object.keys(G).forEach(id => { const g = G[id]; if (!g.adj || id === tit || ocupado(id) || !hab(id)) return; const ss = sit(id, k); if (ss === 'recesso' || ss === 'afastado') return; cand.push({ gid: id, nome: g.nome, origem: 'Adjunto habilitado', obs: T(id, k) === t ? `trabalha neste turno como ${g.grupo === 'Operacional' ? 'agente' : g.eqNome} (sairia da função atual)` : ss === 'servico' ? 'em outro turno' : 'em folga: seria serviço extra' }); });
            (ctx.rua || []).map(i => E[i]).filter(Boolean).forEach(o => { const s2 = o.supIds[0]; if (!s2 || s2 === tit || ocupado(s2) || T(s2, k) !== 'F' || ctx.aus(s2, k) || ctx.comp(s2, k)) return; cand.push({ gid: s2, nome: nome(s2), origem: 'Supervisor de outra equipe', obs: 'em folga: seria serviço extra' }); });
          }
          const faltam = s === 'servico' || cobertoPor ? 0 : 1;
          linhas.push({ id: `${k}|sup|${t}|${e.id}`, k, linha: 'sup', turno: t, titulo: `Supervisão ${t === 'D' ? 'diurna' : 'noturna'} — ${e.nome}`, equipes: [e.nome], titular: { gid: tit, nome: nome(tit), sit: s }, coberturaPor: cobertoPor, pessoas: [{ gid: tit, nome: nome(tit), sit: s, obs: 'titular' }].concat(cobertoPor ? [{ gid: cobertoPor.gid, nome: nome(cobertoPor.gid), sit: cobertoPor.tipo === 'adjunto' ? 'adjunto' : 'remanejado', obs: cobertoPor.tipo === 'adjunto' ? 'adjunto designado' : 'outro supervisor' }] : []),
            previstos: 1, disponiveis: s === 'servico' || cobertoPor ? 1 : 0, minimo: 1, faltam, candidatos: cand, restante: faltam && !cand.length ? 1 : 0, extraPotencial: faltam && !cand.length ? 1 : 0, key: `${k}|${t}|${e.id}`, status: faltam ? 'deficit' : prop ? 'pendencia' : 'ok' });
        });
      });
      /* — Central de Monitoramento (um servidor por dia) — */
      if ((ctx.linha.central || []).length) {
        const des = (op.central || {})[k], gid = des && des.g, disp = gid ? sit(gid, k) === 'servico' && T(gid, k) !== 'F' : false;
        const cand = (ctx.linha.central || []).filter(id => hab(id) && T(id, k) !== 'F' && sit(id, k) === 'servico' && !atr.some(a => a.gid === id && a.k === k && a.papel !== 'central'));
        const proposta = des && des.st === 'proposta';
        const faltam = gid && disp && !proposta ? 0 : 1;
        linhas.push({ id: `${k}|central|*`, k, linha: 'central', turno: '*', titulo: 'Central de Monitoramento', pessoas: gid ? [{ gid, nome: nome(gid), eq: G[gid].eqNome, sit: disp ? (proposta ? 'proposta' : 'servico') : sit(gid, k), obs: 'designado(a)' }] : [], previstos: 1, disponiveis: faltam ? 0 : 1, minimo: 1, faltam,
          candidatos: cand.map(id => ({ gid: id, nome: nome(id), origem: 'Central', obs: 'disponível neste dia' })), restante: faltam && !cand.length ? 1 : 0, extraPotencial: faltam && !cand.length ? 1 : 0,
          semDesignado: !gid, designadoIndisponivel: !!gid && !disp, status: faltam ? 'deficit' : 'ok' });
      }
      dias.push({ k, dow: dow(k), rotuloDia: DS[dow(k)] + ' ' + curto(k), linhas });
    });
    dias.forEach(d => d.linhas.forEach(l => {
      if (l.faltam > 0) deficits.push({ id: l.id, k: l.k, t: l.turno, linha: l.linha, titulo: l.titulo, servico: l.titulo, minimo: l.minimo, disponivel: l.disponiveis, faltam: l.faltam,
        remanejamentos: (l.candidatos || []).slice(0, Math.max(l.faltam, 1)), possiveis: (l.candidatos || []).length, restante: l.restante, extraPotencial: l.extraPotencial, decisao: (op.decisoes || {})[l.id] || null });
    }));
    return { dias, deficits, conflitos, atribuicoes: atr, op };
  }

  /* ---------- estado da escala ---------- */
  // problemas: guardas com erro de validação; gr: resultado de calcularGrade; propostas: nº de propostas sem autorização
  function statusEscala(r) {
    const inc = (r.inconsistencias || []), incAbertas = inc.filter(i => !i.decisao).length, defSemDecisao = (r.deficits || []).filter(d => !d.decisao).length;
    const erros = incAbertas + (r.conflitos || []).length + (r.semGrupo || 0) + defSemDecisao;
    const pendencias = erros + (r.propostas || 0) + (r.rodizio || 0);
    const excecoes = inc.filter(i => i.decisao).length + (r.deficits || []).filter(d => d.decisao).length + (r.rodizioDecidido || 0);
    const estado = r.aprovada ? (pendencias ? 'aprovada_com_pendencias' : 'aprovada') : pendencias ? 'pendencias' : 'validada';
    return { estado, erros, pendencias, defSemDecisao, incAbertas, excecoes, rotulo: { aprovada: 'APROVADA', aprovada_com_pendencias: 'APROVADA COM PENDÊNCIAS', pendencias: 'RASCUNHO — COM PENDÊNCIAS', validada: 'RASCUNHO — VALIDADA, AGUARDANDO APROVAÇÃO' }[estado] + (excecoes && (estado === 'aprovada' || estado === 'validada') ? ` (${excecoes} exceção(ões) por decisão administrativa)` : '') };
  }

  return { add, dif, intervalo, parse, fmt, dow, curto, norm, DS, ROTULO, plantoes, bloco, diasDoBloco, validarBloco, candidatos, inconsistencia, dividirUnidade, parseCSV, periodoDe, validarHistorico, calcularGrade, statusEscala, OPPADRAO, PAPEL_ROT };
});
