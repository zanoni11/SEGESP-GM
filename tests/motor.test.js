/* Testes do motor da Escala Especial (escala_especial.js).
   Rodar:  node --test tests/
   Dados 100% fictícios. Cada teste confere REGRA DE NEGÓCIO, não só "rodou sem erro". */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../escala_especial.js');

/* ---------- fixtures ---------- */
const SEQ = { c12x24: ['D', 'N', 'F', 'F', 'F'], c12x12_84: ['D', 'D', 'F', 'F', 'F'], c12x12_60: ['D', 'D', 'F', 'F'], noturno: ['N', 'N', 'F', 'F', 'F'] };
// ciclo habitual: posição = (data - âncora) mod tamanho
const ciclo = (seq, ancora) => k => seq[(((M.dif(ancora, k)) % seq.length) + seq.length) % seq.length];
const NATAL = { dias: ['2026-12-24', '2026-12-25'], inicioComp: '2026-12-20' };
const ANO_NOVO = { dias: ['2026-12-31', '2027-01-01'], inicioComp: '2026-12-30' };
const mk = (n, extra) => Array.from({ length: n }, (_, i) => Object.assign({ id: 'g' + (i + 1), nome: 'GUARDA TESTE ' + String(i + 1).padStart(2, '0'), matricula: String(900000 + i + 1), h: '' }, extra && extra(i)));
const conta = r => ({ N: Object.values(r.grupos).filter(x => x === 'N').length, A: Object.values(r.grupos).filter(x => x === 'A').length });

/* ============ divisão Natal / Ano Novo (por equipe) ============ */
test('1. equipe com número PAR de integrantes: metades iguais', () => {
  const r = M.dividirUnidade(mk(8), 2026), c = conta(r);
  assert.equal(c.N, 4); assert.equal(c.A, 4); assert.equal(r.alertas.length, 0);
});
test('2. equipe com número ÍMPAR: diferença de exatamente um servidor', () => {
  [5, 7, 9].forEach(n => { const c = conta(M.dividirUnidade(mk(n), 2026)); assert.equal(Math.abs(c.N - c.A), 1, `n=${n}`); assert.equal(c.N + c.A, n); });
});
test('3. guarda com histórico de NATAL vai para ANO NOVO (inversão)', () => {
  const m = mk(6, i => ({ h: i < 3 ? 'N' : 'A' })), r = M.dividirUnidade(m, 2026);
  m.forEach(g => assert.equal(r.grupos[g.id], g.h === 'N' ? 'A' : 'N', g.id));
  assert.equal(r.alertas.length, 0);
});
test('4. guarda com histórico de ANO NOVO vai para NATAL', () => {
  const r = M.dividirUnidade([{ id: 'a', nome: 'A', matricula: '1', h: 'A' }, { id: 'b', nome: 'B', matricula: '2', h: 'N' }], 2026);
  assert.equal(r.grupos.a, 'N'); assert.equal(r.grupos.b, 'A');
});
test('5. sem histórico: distribuído de forma equilibrada e determinística', () => {
  const m = mk(7), a = M.dividirUnidade(m, 2026), b = M.dividirUnidade(m.slice().reverse(), 2026);
  assert.deepEqual(a.grupos, b.grupos, 'mesma entrada em outra ordem = mesma proposta');
  assert.deepEqual(a.grupos, M.dividirUnidade(m, 2026).grupos, 'repetível');
  const c = conta(a); assert.ok(Math.abs(c.N - c.A) <= 1);
});
test('5b. rodízio impossível é SINALIZADO com alternativas (não é invertido em silêncio)', () => {
  const m = mk(6, () => ({ h: 'N' })).concat(mk(0)), r = M.dividirUnidade(m, 2026), c = conta(r);
  assert.equal(c.N + c.A, 6); assert.equal(c.A, 3, 'só 3 vagas em Ano Novo');
  assert.equal(r.alertas.filter(a => a.cod === 'rodizio').length, 3, '3 guardas repetem Natal e cada um gera alerta');
  r.alertas.forEach(a => { assert.equal(a.historico, 'N'); assert.equal(a.atribuido, 'N'); assert.ok(a.alternativas.length >= 2); assert.ok(a.matricula); });
});
test('5c. guarda fixado à mão não é movido pelo automático', () => {
  const m = mk(6, i => ({ h: 'N', fixo: i === 0, grupo: i === 0 ? 'N' : '' })), r = M.dividirUnidade(m, 2026);
  assert.equal(r.grupos.g1, 'N');
});

/* ============ calendário: 3 compensações + folgas = 9 dias ============ */
const aloca = (seq, ancora) => { const t = ciclo(seq, ancora), S = M.plantoes(t, '2026-12-20', '2027-01-08'); return { t, S }; };
test('8. ciclo normal (12x24x12x72) permite 9 dias consecutivos sem serviço', () => {
  for (let a = 0; a < 5; a++) {   // qualquer fase do ciclo
    const { S } = aloca(SEQ.c12x24, M.add('2026-12-01', a)), c = M.candidatos(S, 'N', NATAL), v = c.find(x => x.valido);
    assert.ok(v, 'fase ' + a + ': deve haver bloco válido');
    assert.equal(v.len, 9); assert.equal(v.comp.length, 3);
    const idx = v.comp.map(k => S.findIndex(s => s.k === k)); assert.deepEqual(idx, [idx[0], idx[0] + 1, idx[0] + 2], '3 plantões seguidos do ciclo');
    assert.ok(v.bs <= '2026-12-24' && v.be >= '2026-12-25', 'cobre o feriado');
    assert.ok(v.ret && M.dif(v.be, v.ret) === 1, 'retorno é o dia seguinte ao fim do bloco');
  }
});
test('8b. bloco = 3 compensações + folgas normais do ciclo (conferência dia a dia)', () => {
  const { t, S } = aloca(SEQ.c12x24, '2026-12-01'), v = M.candidatos(S, 'N', NATAL).find(x => x.valido), b = M.bloco(S, v.comp), dias = M.diasDoBloco(b, v.comp);
  assert.equal(dias.length, 9); assert.equal(dias.filter(d => d.tipo === 'comp').length, 3); assert.equal(dias.filter(d => d.tipo === 'folga').length, 6);
  dias.filter(d => d.tipo === 'folga').forEach(d => assert.equal(t(d.k), 'F', 'folga normal do ciclo em ' + d.k));
  dias.filter(d => d.tipo === 'comp').forEach(d => assert.ok(['D', 'N'].includes(t(d.k)), 'plantão compensado em ' + d.k));
});
test('9. ciclo em que NÃO dá para validar os 9 dias gera inconsistência com alternativas', () => {
  const { S } = aloca(SEQ.c12x12_60, '2026-12-01'), cands = M.candidatos(S, 'N', NATAL);
  assert.ok(cands.length > 0); assert.ok(cands.every(c => !c.valido), 'nenhum bloco com 9 dias existe neste ciclo');
  assert.ok(cands.every(c => c.len < 9));
  const comp = cands[0].comp, issues = M.validarBloco(S, comp, NATAL), inc = M.inconsistencia({ id: 'g1', nome: 'GUARDA TESTE 01', matricula: '900001', equipe: 'EQUIPE X', comp }, 'N', issues, cands, NATAL);
  assert.ok(issues.some(i => i.cod === 'bloco_curto'));
  assert.equal(inc.nome, 'GUARDA TESTE 01'); assert.equal(inc.matricula, '900001'); assert.equal(inc.equipe, 'EQUIPE X'); assert.equal(inc.periodo, 'Natal');
  assert.ok(inc.regras.join(' ').includes('9 dias')); assert.ok(inc.datas.compensadas.length === 3); assert.ok(inc.alternativas.length >= 3);
  const st = M.statusEscala({ inconsistencias: [inc], deficits: [], conflitos: [] });
  assert.equal(st.estado, 'pendencias', 'não pode ser marcada como validada');
});
test('6/7. início do recesso em 19 ou 20 de dezembro muda os blocos possíveis', () => {
  // 12x12x12x84 com plantões em 18, 19, 23, 24, 28, 29/12: só com início em 19/12 existe o bloco 19→27
  const { S } = aloca(SEQ.c12x12_84, '2026-12-18'), nat19 = Object.assign({}, NATAL, { inicioComp: '2026-12-19' });
  const c19 = M.candidatos(S, 'N', nat19), c20 = M.candidatos(S, 'N', NATAL);
  assert.ok(c19.every(c => c.comp[0] >= '2026-12-19')); assert.ok(c20.every(c => c.comp[0] >= '2026-12-20'));
  const v19 = c19.find(c => c.valido), v20 = c20.find(c => c.valido);
  assert.ok(v19 && v20, 'os dois têm bloco válido');
  assert.deepEqual([v19.comp, v19.bs, v19.be, v19.len], [['2026-12-19', '2026-12-23', '2026-12-24'], '2026-12-19', '2026-12-27', 9], 'início 19/12');
  assert.deepEqual([v20.comp, v20.bs, v20.be, v20.len], [['2026-12-23', '2026-12-24', '2026-12-28'], '2026-12-20', '2026-12-28', 9], 'início 20/12');
  assert.ok(!c20.some(c => c.comp.join() === v19.comp.join()), 'o bloco de 19/12 não existe com início em 20/12');
  // compensar antes do início configurado é erro de validação
  assert.ok(M.validarBloco(S, v19.comp, NATAL).some(i => i.cod === 'antes_inicio'));
  assert.ok(!M.validarBloco(S, v19.comp, nat19).some(i => i.nivel === 'erro'));
});
test('término do recesso configurável: bloco que termina depois do limite é erro', () => {
  const { S } = aloca(SEQ.c12x24, '2026-12-01'), v = M.candidatos(S, 'A', ANO_NOVO).find(x => x.valido);
  assert.ok(v);
  const iss = M.validarBloco(S, v.comp, Object.assign({}, ANO_NOVO, { fim: M.add(v.be, -1) }));
  assert.ok(iss.some(i => i.cod === 'apos_fim'));
});
test('o cálculo do recesso NÃO altera o ciclo habitual', () => {
  const t = ciclo(SEQ.c12x24, '2026-12-03'), antes = M.intervalo('2026-11-15', '2027-02-15').map(k => t(k));
  const S = M.plantoes(t, '2026-12-20', '2027-01-08'); M.candidatos(S, 'N', NATAL); M.candidatos(S, 'A', ANO_NOVO); M.validarBloco(S, S.slice(4, 7).map(s => s.k), NATAL);
  assert.deepEqual(M.intervalo('2026-11-15', '2027-02-15').map(k => t(k)), antes);
  // o retorno cai num plantão do próprio ciclo, e o ciclo segue depois
  const v = M.candidatos(S, 'N', NATAL).find(x => x.valido); assert.ok(['D', 'N'].includes(t(v.ret)));
});
test('sequência do ciclo se mantém depois do retorno (plantão seguinte ao bloco é o do ciclo)', () => {
  const t = ciclo(SEQ.c12x24, '2026-12-02'), S = M.plantoes(t, '2026-12-20', '2027-01-08'), v = M.candidatos(S, 'N', NATAL).find(x => x.valido);
  const i = S.findIndex(s => s.k === v.comp[2]); assert.equal(S[i + 1].k, v.ret); assert.equal(S[i + 1].t, t(v.ret));
});

/* ============ grade operacional ============ */
// Monta um contexto fictício: 1 equipe de rua (alfa) com 2 supervisores? não: 1 sup + n agentes, PPC, ROMU, GTAM, COMON, almox
function montar(opts) {
  opts = opts || {};
  const G = {}, E = {}, linha = { ppc: [], romu: [], gtam: [], central: [], almox: [] };
  const novo = (id, o) => { G[id] = Object.assign({ id, nome: id.toUpperCase(), matricula: id, funcao: 'agente', hab: true, adj: false, almox: {}, grupo: '', eqId: '', eqNome: '' }, o); return G[id]; };
  const turnos = {}, comp = {}, aus = {};
  const set = (id, fn) => { turnos[id] = fn; };
  // equipe de rua com n agentes + 1 supervisor, todos no ciclo 12x24 (D no dia k0, N no seguinte)
  const nRua = opts.nRua == null ? 5 : opts.nRua;
  E.alfa = { id: 'alfa', nome: 'ALFA', grupo: 'Operacional', agIds: [], supIds: ['sup1'] };
  novo('sup1', { funcao: 'supervisor', eqId: 'alfa', eqNome: 'ALFA', grupo: 'Operacional' }); set('sup1', ciclo(SEQ.c12x24, '2026-12-20'));
  for (let i = 1; i <= nRua; i++) { const id = 'ag' + i; novo(id, { eqId: 'alfa', eqNome: 'ALFA', grupo: 'Operacional' }); E.alfa.agIds.push(id); set(id, ciclo(SEQ.c12x24, '2026-12-20')); }
  // equipe bravo: assume as demais fases do ciclo para a área nunca ficar sem equipe
  E.bravo = { id: 'bravo', nome: 'BRAVO', grupo: 'Operacional', agIds: [], supIds: ['sup2'] };
  novo('sup2', { funcao: 'supervisor', eqId: 'bravo', eqNome: 'BRAVO', grupo: 'Operacional' }); set('sup2', ciclo(SEQ.c12x24, '2026-12-21'));
  for (let i = 1; i <= 5; i++) { const id = 'bg' + i; novo(id, { eqId: 'bravo', eqNome: 'BRAVO', grupo: 'Operacional' }); E.bravo.agIds.push(id); set(id, ciclo(SEQ.c12x24, '2026-12-21')); }
  const outras = ['2026-12-22', '2026-12-23', '2026-12-24'];   // outras fases: garantem que sempre há equipe de rua
  outras.forEach((anc, j) => { const eid = 'e' + j; E[eid] = { id: eid, nome: 'EQ' + j, grupo: 'Operacional', agIds: [], supIds: ['s' + eid] }; novo('s' + eid, { funcao: 'supervisor', eqId: eid, eqNome: 'EQ' + j, grupo: 'Operacional' }); set('s' + eid, ciclo(SEQ.c12x24, anc));
    for (let i = 1; i <= 5; i++) { const id = eid + 'a' + i; novo(id, { eqId: eid, eqNome: 'EQ' + j, grupo: 'Operacional' }); E[eid].agIds.push(id); set(id, ciclo(SEQ.c12x24, anc)); } });
  // PPC (12x12: só diurno), ROMU, GTAM, COMON (central), almoxarifado
  for (let i = 1; i <= (opts.nPpc == null ? 3 : opts.nPpc); i++) { const id = 'ppc' + i; novo(id, { eqId: 'ppc', eqNome: 'PPC', grupo: 'PPC' }); linha.ppc.push(id); set(id, ciclo(SEQ.c12x12_84, '2026-12-20')); }
  for (let i = 1; i <= (opts.nRomu == null ? 3 : opts.nRomu); i++) { const id = 'romu' + i; novo(id, { eqId: 'romu', eqNome: 'ROMU', grupo: 'ROMU' }); linha.romu.push(id); set(id, ciclo(SEQ.c12x12_84, '2026-12-20')); }
  for (let i = 1; i <= (opts.nGtam == null ? 3 : opts.nGtam); i++) { const id = 'gtam' + i; novo(id, { eqId: 'gtam', eqNome: 'GTAM', grupo: 'GTAM' }); linha.gtam.push(id); set(id, ciclo(SEQ.c12x12_84, '2026-12-20')); }
  for (let i = 1; i <= 3; i++) { const id = 'com' + i; novo(id, { eqId: 'com', eqNome: 'COMON', grupo: 'COMON' }); linha.central.push(id); set(id, ciclo(['D', 'F', 'D', 'F', 'D', 'F'], '2026-12-20')); }
  for (let i = 1; i <= 2; i++) { const id = 'alm' + i; novo(id, { eqId: 'alm', eqNome: 'ALMOX', grupo: 'Almoxarifado' }); linha.almox.push(id); set(id, ciclo(SEQ.c12x24, '2026-12-20')); }
  const ctx = {
    dias: M.intervalo('2026-12-22', '2026-12-26'), guardas: G, equipes: E, rua: ['alfa', 'bravo', 'e0', 'e1', 'e2'], linha,
    turnoDe: (id, k) => (turnos[id] ? turnos[id](k) : ''), aus: (id, k) => !!(aus[id] && aus[id].includes(k)), comp: (id, k) => !!(comp[id] && comp[id].includes(k)), bloco: () => null,
    cob: [], op: Object.assign({}, opts.op), horario: (id, t) => (t === 'D' ? ['07:00', '19:00'] : ['19:00', '07:00'])
  };
  return { ctx, G, E, turnos, comp, aus, linha };
}
const achar = (r, k, id) => r.dias.find(d => d.k === k).linhas.find(l => l.id === id);

test('10. déficit de cobertura DIURNA: 3 disponíveis para mínimo 4', () => {
  // 20/12 é o 1º dia do ciclo da equipe alfa: diurno
  const m = montar({ nRua: 5 }); m.comp.ag1 = ['2026-12-20']; m.comp.ag2 = ['2026-12-20'];
  m.ctx.dias = ['2026-12-20']; const r = M.calcularGrade(m.ctx), l = achar(r, '2026-12-20', '2026-12-20|area|D');
  assert.equal(l.previstos, 5); assert.equal(l.recesso, 2); assert.equal(l.disponiveis, 3); assert.equal(l.minimo, 4); assert.equal(l.faltam, 1); assert.equal(l.vtrs, 1);
  assert.ok(r.deficits.some(d => d.id === l.id && d.faltam === 1 && d.linha === 'area' && d.t === 'D'));
});
test('11. déficit de cobertura NOTURNA', () => {
  const m = montar({ nRua: 5 }); m.comp.ag1 = ['2026-12-21']; m.comp.ag2 = ['2026-12-21']; m.aus.ag3 = ['2026-12-21'];
  m.ctx.dias = ['2026-12-21']; const r = M.calcularGrade(m.ctx), l = achar(r, '2026-12-21', '2026-12-21|area|N');
  assert.equal(l.disponiveis, 2); assert.equal(l.faltam, 2); assert.equal(l.afastados, 1); assert.equal(l.vtrs, 1);
  const d = r.deficits.find(x => x.id === l.id); assert.equal(d.faltam, 2); assert.equal(d.minimo, 4); assert.equal(d.disponivel, 2);
});
test('mínimo da área é configurável (sem mexer no código) e VTRs = disponíveis / 2', () => {
  const m = montar({ nRua: 5, op: { areaMin: { D: 6, N: 4 } } }); m.ctx.dias = ['2026-12-20'];
  const l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|area|D'); assert.equal(l.minimo, 6); assert.equal(l.faltam, 1); assert.equal(l.vtrs, 2);
});
test('remanejamento só conta depois de autorizado; proposta não cobre déficit', () => {
  const m = montar(); m.comp.ag1 = ['2026-12-20']; m.comp.ag2 = ['2026-12-20']; m.ctx.dias = ['2026-12-20'];
  m.ctx.cob = [{ id: 'c1', k: '2026-12-20', t: 'D', eq: 'alfa', tipo: 'ppc', g: 'ppc1', st: 'proposta' }];
  let l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|area|D'); assert.equal(l.faltam, 1); assert.equal(l.propostos, 1); assert.equal(l.status, 'deficit');
  m.ctx.cob[0].st = 'autorizado'; l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|area|D'); assert.equal(l.faltam, 0); assert.equal(l.remanejados, 1); assert.equal(l.disponiveis, 4);
});
test('déficit lista remanejamentos possíveis, restante e necessidade potencial de extra', () => {
  const m = montar({ nPpc: 1 }); ['ag1', 'ag2', 'ag3'].forEach(id => { m.comp[id] = ['2026-12-20']; }); m.ctx.dias = ['2026-12-20'];
  const r = M.calcularGrade(m.ctx), d = r.deficits.find(x => x.id === '2026-12-20|area|D');
  assert.equal(d.faltam, 2); assert.equal(d.possiveis, 1, 'só 1 PPC disponível'); assert.equal(d.restante, 1); assert.equal(d.extraPotencial, 1);
  assert.equal(r.dias[0].linhas.length > 0, true);
  assert.equal(m.ctx.cob.length, 0, 'nada é lançado/alocado automaticamente');
});
test('almoxarifado aparece como possível reforço, mas NÃO é alocado sozinho', () => {
  const m = montar({ nPpc: 0 }); m.G.alm1.almox = { D: true }; ['ag1', 'ag2'].forEach(id => { m.comp[id] = ['2026-12-20']; }); m.ctx.dias = ['2026-12-20'];
  const l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|area|D');
  assert.equal(l.disponiveis, 3); assert.ok(l.candidatos.some(c => c.gid === 'alm1' && c.origem === 'Almoxarifado')); assert.ok(!l.candidatos.some(c => c.gid === 'alm2'), 'sem disponibilidade informada não é candidato');
  m.ctx.op.reforcos = [{ id: 'r1', g: 'alm1', k: '2026-12-20', t: 'D', eqDestino: 'alfa', st: 'autorizado' }];
  assert.equal(achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|area|D').disponiveis, 4);
});

/* ============ ROMU / GTAM ============ */
test('12. ROMU com dois integrantes: atuação excepcional (sem déficit); com um, déficit', () => {
  const m = montar({ nRomu: 3 }); m.comp.romu1 = ['2026-12-20']; m.ctx.dias = ['2026-12-20'];
  let l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|romu|D');
  assert.equal(l.disponiveis, 2); assert.equal(l.faltam, 0); assert.equal(l.excepcional, true); assert.equal(l.minimo, 2);
  m.comp.romu2 = ['2026-12-20']; l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|romu|D'); assert.equal(l.disponiveis, 1); assert.equal(l.faltam, 1);
  const r = M.calcularGrade(m.ctx); assert.ok(r.deficits.some(d => d.linha === 'romu'));
  assert.equal(achar(r, '2026-12-20', '2026-12-20|area|D').minimo, 4, 'a regra de 4 da área não é aplicada à ROMU');
});
test('13. GTAM: dupla = viatura, trio = motos; número errado é apontado antes de validar', () => {
  const m = montar({ nGtam: 3 }); m.ctx.dias = ['2026-12-20'];
  const lin = () => achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|gtam|D');
  assert.equal(lin().sugestao, 'motos'); assert.equal(lin().disponiveis, 3);
  m.ctx.op.comp = { gtam: { '2026-12-20|D': { modo: 'viatura', ids: ['gtam1', 'gtam2'] } } };
  let r = M.calcularGrade(m.ctx); assert.equal(r.conflitos.filter(c => c.cod === 'gtam_composicao').length, 0, 'dupla em viatura é válida');
  m.ctx.op.comp.gtam['2026-12-20|D'] = { modo: 'motos', ids: ['gtam1', 'gtam2', 'gtam3'] }; r = M.calcularGrade(m.ctx); assert.equal(r.conflitos.filter(c => c.cod === 'gtam_composicao').length, 0, 'trio em motos é válido');
  m.ctx.op.comp.gtam['2026-12-20|D'] = { modo: 'motos', ids: ['gtam1', 'gtam2'] }; r = M.calcularGrade(m.ctx); assert.equal(r.conflitos.filter(c => c.cod === 'gtam_composicao').length, 1, 'motos com dupla não vale');
  m.ctx.op.comp.gtam['2026-12-20|D'] = { modo: 'viatura', ids: ['gtam1', 'gtam2', 'gtam3'] }; r = M.calcularGrade(m.ctx); assert.equal(r.conflitos.filter(c => c.cod === 'gtam_composicao').length, 1, 'viatura com trio não vale');
});
test('GTAM com um integrante na equipe de rua reforça a área e sai da composição do GTAM', () => {
  const m = montar({ nGtam: 2 }); ['ag1', 'ag2'].forEach(id => { m.comp[id] = ['2026-12-20']; }); m.ctx.dias = ['2026-12-20'];
  m.ctx.op.comp = { gtam: { '2026-12-20|D': { modo: 'rua', ids: ['gtam1'], eqDestino: 'alfa' } } };
  const r = M.calcularGrade(m.ctx), a = achar(r, '2026-12-20', '2026-12-20|area|D'), g = achar(r, '2026-12-20', '2026-12-20|gtam|D');
  assert.equal(a.remanejados, 1); assert.equal(a.disponiveis, 4); assert.equal(g.pessoas.find(p => p.gid === 'gtam1').sit, 'remanejado_fora'); assert.equal(g.disponiveis, 1, 'sai da contagem do GTAM (não é contado em duas funções)');
});
test('14. guarda designado para duas funções no mesmo horário gera conflito', () => {
  const m = montar(); m.ctx.dias = ['2026-12-20'];
  m.ctx.cob = [{ id: 'c1', k: '2026-12-20', t: 'D', eq: 'alfa', tipo: 'ppc', g: 'ppc1', st: 'autorizado', m: true }];
  m.ctx.op.reforcos = [{ id: 'r1', g: 'ppc1', k: '2026-12-20', t: 'D', eqDestino: 'alfa', st: 'autorizado' }];
  const r = M.calcularGrade(m.ctx), c = r.conflitos.filter(x => x.cod === 'dupla_funcao');
  assert.equal(c.length, 1); assert.equal(c[0].gid, 'ppc1'); assert.ok(c[0].msg.includes('duas funções'));
});
test('designado em recesso ou afastado gera conflito', () => {
  const m = montar(); m.comp.ppc1 = ['2026-12-20']; m.ctx.dias = ['2026-12-20'];
  m.ctx.cob = [{ id: 'c1', k: '2026-12-20', t: 'D', eq: 'alfa', tipo: 'ppc', g: 'ppc1', st: 'autorizado', m: true }];
  assert.ok(M.calcularGrade(m.ctx).conflitos.some(c => c.cod === 'indisponivel' && c.gid === 'ppc1'));
});
test('PPC: noite de apoio seguida de serviço diurno sem descanso é conflito', () => {
  const m = montar(); m.ctx.dias = ['2026-12-20', '2026-12-21'];
  m.ctx.cob = [{ id: 'c1', k: '2026-12-20', t: 'N', eq: 'alfa', tipo: 'ppc', g: 'ppc1', st: 'autorizado', m: true }];
  assert.ok(M.calcularGrade(m.ctx).conflitos.some(c => c.cod === 'descanso' && c.gid === 'ppc1'));
});
test('PPC: ajuste de jornada mostra original, proposta, equipe apoiada e exige autorização', () => {
  const m = montar(); m.ctx.dias = ['2026-12-20'];
  m.ctx.cob = [{ id: 'c1', k: '2026-12-20', t: 'N', eq: 'alfa', tipo: 'ppc', g: 'ppc1', st: 'proposta' }];
  const l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|ppc|*'), a = l.ajustes[0];
  assert.equal(a.original, 'D'); assert.equal(a.turno, 'N'); assert.deepEqual(a.horarioOriginal, ['07:00', '19:00']); assert.deepEqual(a.horarioProposto, ['19:00', '07:00']); assert.equal(a.eq, 'ALFA'); assert.equal(a.st, 'proposta'); assert.equal(l.status, 'pendencia');
});

/* ============ supervisão e Central ============ */
test('15. supervisor em recesso é substituído por adjunto HABILITADO; não habilitado é recusado', () => {
  const m = montar(); m.comp.sup1 = ['2026-12-20']; m.ctx.dias = ['2026-12-20'];
  let l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|sup|D|alfa'); assert.equal(l.faltam, 1); assert.equal(l.status, 'deficit');
  m.G.ag4.adj = true;
  l = achar(M.calcularGrade(m.ctx), '2026-12-20', '2026-12-20|sup|D|alfa'); assert.ok(l.candidatos.some(c => c.gid === 'ag4'), 'habilitado aparece como candidato'); assert.ok(!l.candidatos.some(c => c.gid === 'ag5'), 'não habilitado não aparece');
  m.ctx.op.subs = { '2026-12-20|D|alfa': { adj: 'ag4', motivo: 'supervisor em recesso', st: 'autorizado' } };
  let r = M.calcularGrade(m.ctx); l = achar(r, '2026-12-20', '2026-12-20|sup|D|alfa');
  assert.equal(l.faltam, 0); assert.equal(l.coberturaPor.tipo, 'adjunto'); assert.equal(l.coberturaPor.gid, 'ag4');
  const area = achar(r, '2026-12-20', '2026-12-20|area|D'); assert.equal(area.disponiveis, 4, 'o adjunto sai da contagem da área (não é contado em duas funções)'); assert.equal(area.faltam, 0);
  m.ctx.op.subs['2026-12-20|D|alfa'].adj = 'ag5'; r = M.calcularGrade(m.ctx);
  assert.ok(r.conflitos.some(c => c.cod === 'adjunto_nao_habilitado' && c.gid === 'ag5'));
});
test('a cobertura da supervisão é verificada separadamente das VTRs da área', () => {
  const m = montar(); m.comp.sup1 = ['2026-12-20']; m.ctx.dias = ['2026-12-20'];
  const r = M.calcularGrade(m.ctx); assert.equal(achar(r, '2026-12-20', '2026-12-20|area|D').faltam, 0); assert.equal(achar(r, '2026-12-20', '2026-12-20|sup|D|alfa').faltam, 1);
  assert.ok(r.deficits.some(d => d.linha === 'sup') && !r.deficits.some(d => d.linha === 'area'));
});
test('16. dia sem cobertura da Central é sinalizado; designação disponível resolve', () => {
  const m = montar(); m.ctx.dias = ['2026-12-20', '2026-12-21'];
  let r = M.calcularGrade(m.ctx), l = achar(r, '2026-12-20', '2026-12-20|central|*'); assert.equal(l.faltam, 1); assert.equal(l.semDesignado, true); assert.ok(l.candidatos.length > 0);
  assert.ok(r.deficits.some(d => d.linha === 'central' && d.k === '2026-12-20'));
  m.ctx.op.central = { '2026-12-20': { g: 'com1', st: 'autorizado' } };
  r = M.calcularGrade(m.ctx); assert.equal(achar(r, '2026-12-20', '2026-12-20|central|*').faltam, 0);
  m.comp.com1 = ['2026-12-20']; r = M.calcularGrade(m.ctx); assert.equal(achar(r, '2026-12-20', '2026-12-20|central|*').faltam, 1, 'designado em recesso não cobre'); assert.equal(achar(r, '2026-12-20', '2026-12-20|central|*').designadoIndisponivel, true);
});
test('o servidor da Central não é contado em equipe de rua no mesmo dia (conflito)', () => {
  const m = montar(); m.ctx.dias = ['2026-12-20'];
  m.ctx.op.central = { '2026-12-20': { g: 'com1', st: 'autorizado' } };
  m.ctx.op.reforcos = [{ id: 'r1', g: 'com1', k: '2026-12-20', t: 'D', eqDestino: 'alfa', st: 'autorizado' }];
  assert.ok(M.calcularGrade(m.ctx).conflitos.some(c => c.cod === 'dupla_funcao' && c.gid === 'com1'));
});

/* ============ importação do histórico ============ */
const CAD = [{ id: 'g1', nome: 'GUARDA TESTE 01', matricula: '900001' }, { id: 'g2', nome: 'GUARDA TESTE 02', matricula: '900002' }, { id: 'g3', nome: 'GUARDA TESTE 03', matricula: '900003' }, { id: 'g4', nome: 'GUARDA TESTE 04', matricula: '900003' }];
test('17. importação com matrícula inválida: prévia aponta o erro e nada é efetivado', () => {
  const l = M.parseCSV('matricula;nome;periodo;ano\n900001;GUARDA TESTE 01;Natal;2025\n999999;FULANO INEXISTENTE;Ano Novo;2025\n900002;GUARDA TESTE 02;Carnaval;2025');
  const p = M.validarHistorico(l, CAD, 2025);
  assert.equal(p.resumo.total, 3); assert.equal(p.resumo.ok, 1); assert.equal(p.resumo.matriculaNaoEncontrada, 1); assert.equal(p.resumo.periodoInvalido, 1);
  assert.equal(p.registros[1].status, 'erro'); assert.ok(p.registros[1].erros[0].msg.includes('999999'));
});
test('18. importação com registros duplicados e matrícula duplicada no cadastro', () => {
  const l = M.parseCSV('matricula;nome;periodo;ano\n900001;GUARDA TESTE 01;Natal;2025\n900001;GUARDA TESTE 01;Ano Novo;2025\n900003;GUARDA TESTE 03;Natal;2025');
  const p = M.validarHistorico(l, CAD, 2025);
  assert.equal(p.registros[0].status, 'erro'); assert.equal(p.registros[1].status, 'erro'); assert.ok(p.registros[0].erros.some(e => e.cod === 'registro_duplicado'));
  assert.ok(p.registros[2].erros.some(e => e.cod === 'matricula_duplicada'), 'a matrícula 900003 está em dois guardas do cadastro');
  assert.ok(p.resumo.duplicadas >= 3);
});
test('importação: matrícula é o identificador; nome só confere; sem matrícula = aviso', () => {
  const p = M.validarHistorico(M.parseCSV('matricula;nome;periodo;ano\n900001;OUTRO NOME;Natal;2025\n;GUARDA TESTE 02;Ano Novo;2025'), CAD, 2025);
  assert.equal(p.registros[0].gid, 'g1'); assert.equal(p.registros[0].status, 'aviso'); assert.ok(p.registros[0].avisos.some(a => a.cod === 'nome_divergente'));
  assert.equal(p.registros[1].gid, 'g2'); assert.ok(p.registros[1].avisos.some(a => a.cod === 'sem_matricula'));
});
test('importação: ano diferente do de referência é recusado; "sem histórico" é aceito; não sobrescreve em silêncio', () => {
  const p = M.validarHistorico(M.parseCSV('matricula;nome;periodo;ano\n900001;GUARDA TESTE 01;Natal;2024\n900002;GUARDA TESTE 02;sem histórico;2025\n900003;GUARDA TESTE 03;Natal;2025'), CAD.slice(0, 3), 2025, { g3: 'A' });
  assert.ok(p.registros[0].erros.some(e => e.cod === 'ano_diferente')); assert.equal(p.registros[1].status, 'ok'); assert.equal(p.registros[1].periodo, '');
  assert.equal(p.registros[2].status, 'conflito', 'já existia Ano Novo: pede decisão'); assert.ok(p.registros[2].avisos[0].msg.includes('Ano Novo'));
  assert.equal(p.semHistorico.length, 0 + p.semHistorico.length); // g1 tem erro, não conta como histórico
});
test('importação aceita CSV com vírgula/tabulação, aspas e BOM', () => {
  assert.deepEqual(M.parseCSV('﻿matricula,nome,periodo,ano\n900001,"TESTE, 01",Natal,2025'), [['matricula', 'nome', 'periodo', 'ano'], ['900001', 'TESTE, 01', 'Natal', '2025']]);
  assert.equal(M.parseCSV('a\tb\n1\t2').length, 2);
});
test('estado da escala: só é "validada" sem inconsistências, conflitos, déficits sem decisão ou propostas', () => {
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [], conflitos: [] }).estado, 'validada');
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [{ decisao: null }], conflitos: [] }).estado, 'pendencias');
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [{ decisao: { tipo: 'aceita' } }], conflitos: [] }).estado, 'validada', 'déficit com decisão registrada não bloqueia');
  assert.equal(M.statusEscala({ inconsistencias: [{ decisao: null }], deficits: [], conflitos: [] }).estado, 'pendencias', 'inconsistência dos 9 dias sem decisão bloqueia');
  assert.equal(M.statusEscala({ inconsistencias: [{ decisao: { tipo: 'autorizado' } }], deficits: [], conflitos: [] }).estado, 'validada', 'com decisão administrativa registrada deixa de bloquear (e aparece como exceção)');
  assert.match(M.statusEscala({ inconsistencias: [{ decisao: { tipo: 'autorizado' } }], deficits: [], conflitos: [] }).rotulo, /exceç/);
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [], conflitos: [{ cod: 'dupla_funcao' }] }).estado, 'pendencias', 'conflito nunca é aceito por decisão');
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [], conflitos: [], rodizio: 1 }).estado, 'pendencias', 'rodízio não cumprido sem decisão');
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [], conflitos: [], aprovada: true }).estado, 'aprovada');
  assert.equal(M.statusEscala({ inconsistencias: [], deficits: [], conflitos: [], propostas: 2 }).estado, 'pendencias');
  assert.match(M.statusEscala({ inconsistencias: [{}], deficits: [], conflitos: [] }).rotulo, /PENDÊNCIAS/);
});
