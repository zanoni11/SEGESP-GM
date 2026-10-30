/* Testes (navegador) da transferência de guarda entre equipes. Dados 100% fictícios; não usa Supabase nem login.
   Rodar:   node tests/e2e.transferencia.js
   Requisitos: Node 18+ e o pacote "playwright" com o Chromium (npm i --no-save playwright).
   Variáveis: PLAYWRIGHT_PATH (pasta do módulo), CHROMIUM_PATH (executável). */
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require(process.env.PLAYWRIGHT_PATH || 'playwright'); } catch (e) { try { pw = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) { console.error('Playwright não encontrado (npm i --no-save playwright).'); process.exit(2); } }
const RAIZ = path.join(__dirname, '..'), TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
let falhas = 0, passou = 0;
const ok = (c, msg, extra) => { if (c) passou++; else falhas++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (c || extra === undefined ? '' : '  → ' + JSON.stringify(extra).slice(0, 400))); };
const srv = http.createServer((q, s) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(RAIZ, u); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.statusCode = 404; return s.end(); } s.setHeader('content-type', TIPOS[path.extname(f)] || 'text/plain'); s.end(fs.readFileSync(f)); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }), page = await ctx.newPage(), erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.route('https://cdn.tailwindcss.com/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/supabase.js', r => r.abort()); await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`); await page.waitForTimeout(600);
  console.log('\nTransferência de equipe: a escala anterior não muda, folga mínima e apresentação na primeira escala possível');
  const r = await page.evaluate(() => {
    const H = (d, n) => ({ D: { agente: d, supervisor: d }, N: { agente: n, supervisor: n } });
    const s = { instituicao: 'Teste', equipes: [], guardas: [], ancorasHist: [],
      ciclos: [{ id: 'c1', nome: '12x24x12x72', sequencia: ['D', 'N', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) }, { id: 'c4', nome: '12x12x12x84', sequencia: ['D', 'D', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) }] };
    [['e1', 'ALFA', 'c1', 'Operacional', '2026-10-01'], ['e2', 'DELTA', 'c1', 'Operacional', '2026-10-03'], ['e3', 'ROMU 1', 'c4', 'ROMU', '2026-10-02'], ['e4', 'FOXTROT', 'c1', 'Operacional', '2026-10-01'], ['e5', 'BRAVO PPC', 'c4', 'PPC', '2026-10-30']].forEach(([id, nome, cicloId, grupo, anc]) => { s.equipes.push({ id, nome, cicloId, grupo, exigeSupervisor: false, efetivoMinimo: 2 }); s.ancorasHist.push({ equipeId: id, data: anc, vigencia: '0000-01-01' }); });
    let n = 0; ['e1', 'e2', 'e3'].forEach(e => { for (let i = 0; i < 3; i++) { n++; s.guardas.push({ id: 'g' + n, nomeCompleto: 'GUARDA TESTE ' + String(n).padStart(3, '0'), nomeGuerra: 'TESTE' + n, matricula: String(n).padStart(3, '0'), funcao: 'agente', equipeId: e }); } });
    state = normalizarEstado(s); _perfilSb = { id: 'u1', nome: 'Teste', login: 'teste', perfil: 'ADMINISTRADOR', ativo: true }; _appPronta = true; _sync.pronto = false;
    const out = {}, g = state.guardas[0], A = g.equipeId, B = 'e2';
    const telas = () => { const e = []; ['hoje', 'semana', 'mes', 'guarda', 'equipe', 'efetivo', 'superv', 'ipm', 'especial', 'cadastros'].forEach(v => { try { go(v); } catch (x) { e.push(v + ': ' + x.message); } }); go('hoje'); return e; };
    out.telasAntes = telas();
    { const gp = { id: 'gp', nomeCompleto: 'GUARDA PPC TESTE', nomeGuerra: 'RODRIGUES', matricula: '900', funcao: 'agente', equipeId: 'e5' }; state.guardas.push(gp); const p31 = trPlano('e5', 'e2', '2026-10-31', 3), p30 = trPlano('e5', 'e2', '2026-10-30', 3);
      out.dia31 = p31.ult === '2026-10-31' && p30.ult === '2026-10-30' && p31.apr >= '2026-11-04'; go('cadastros'); abrirTransferencia('gp', 'e2'); out.campoVazio = $('tr-ate').value === ''; $('tr-ate').value = '2026-10-31'; trPrev('gp'); out.previaPerto = /em volta do dia informado/.test($('tr-prev').innerText); trConfirmar('gp');
      out.nota = editalHTML(2026, 9).includes('BRAVO PPC até 31/10') && /DELTA a partir de/.test(editalHTML(2026, 9)); const tt = state.transferencias.find(x => x.guardaId === 'gp'); out.trabalha31 = statusGuarda(state.guardas.find(x => x.id === 'gp'), parseISO('2026-10-31')).trabalha === true && statusGuarda(state.guardas.find(x => x.id === 'gp'), parseISO('2026-10-31')).transicao.fase === 'ultimo';
      state.transferencias = state.transferencias.filter(x => x !== tt); state.guardas.find(x => x.id === 'gp').equipeId = 'e5'; _trMemo = { ref: null, n: -1, mapa: {} }; }
    const dia = (k, n) => iso(addDays(parseISO(k), n)), cods = (a, b) => { const o = []; for (let k = a; k <= b; k = dia(k, 1)) o.push(k + ':' + statusGuarda(g, parseISO(k)).codigo); return o.join(','); };
    const antes = cods('2026-09-01', '2026-10-31');
    let curto = null, longo = null;
    for (const E of state.equipes.filter(e => e.id !== A)) for (let k = '2026-10-01'; k <= '2026-12-20' && !(curto && longo); k = dia(k, 1)) { const p = trPlano(A, E.id, k, 3); if (p.erro) continue; let prox = dia(p.ult, 1); while (!['D', 'N'].includes(turno(E.id, parseISO(prox)))) prox = dia(prox, 1); const gap = (parseISO(prox) - parseISO(p.ult)) / 864e5 - 1; if (gap < 3 && !curto) curto = { p, prox, gap }; if (gap >= 3 && !longo) longo = { p, prox, gap }; }
    out.curto = curto && { folga: curto.p.folga.length, ok: curto.p.folga.length >= 3 && curto.p.apr > curto.prox && ['D', 'N'].includes(turno(B, parseISO(curto.p.apr))) || (curto.p.folga.length >= 3 && curto.p.apr >= dia(curto.p.ult, 4)) };
    out.longo = longo && { folga: longo.p.folga.length, gap: longo.gap, ok: longo.p.apr === longo.prox && longo.p.folga.length === longo.gap };
    go('cadastros'); abrirTransferencia(g.id, B); $('tr-para').value = B; $('tr-ate').value = '2026-10-30'; $('tr-folga').value = '3'; trPrev(g.id); out.previa = $('tr-prev').innerText.length > 30; trConfirmar(g.id);
    const t = state.transferencias[0]; out.reg = !!t && t.guardaId === g.id && t.deId === A && t.paraId === B && g.equipeId === B; const ult = t.ultimo, apr = t.apresentacao;
    let sem = true; for (let k = dia(ult, 1); k <= '2026-10-30'; k = dia(k, 1)) if (['D', 'N'].includes(turno(A, parseISO(k)))) sem = false;
    out.ultimoPlantao = ['D', 'N'].includes(turno(A, parseISO(ult))) && ult <= '2026-10-30' && sem;
    out.passadoIgual = cods('2026-09-01', ult) === antes.split(',').filter(x => x.slice(0, 10) <= ult).join(',');
    const folga = []; for (let k = dia(ult, 1); k < apr; k = dia(k, 1)) folga.push(k);
    out.folga = folga.length >= 3 && folga.every(k => turnoGuarda(g, parseISO(k)) === 'F' && statusGuarda(g, parseISO(k)).codigo === 'TR') && /Transição de equipe/.test(tituloOcorrencia(statusGuarda(g, parseISO(folga[0]))));
    let primeira = true; for (let k = dia(ult, 4); k < apr; k = dia(k, 1)) if (['D', 'N'].includes(turno(B, parseISO(k)))) primeira = false;
    out.apresenta = ['D', 'N'].includes(turno(B, parseISO(apr))) && apr >= dia(ult, 4) && primeira && statusGuarda(g, parseISO(apr)).transicao.fase === 'apresenta';
    let seg = true; for (let k = apr; k <= dia(apr, 60); k = dia(k, 1)) if (turnoGuarda(g, parseISO(k)) !== turno(B, parseISO(k))) seg = false; out.novaEquipe = seg;
    out.membros = membros(A, parseISO(ult)).some(m => m.id === g.id) && !membros(A, parseISO(dia(ult, 1))).some(m => m.id === g.id) && !membros(B, parseISO(dia(apr, -1))).some(m => m.id === g.id) && membros(B, parseISO(apr)).some(m => m.id === g.id);
    const eqA = getEquipe(A), eqB = getEquipe(B), emA = equipeNoDia(eqA, turno(A, parseISO(ult)), parseISO(ult)), emB = equipeNoDia(eqB, turno(B, parseISO(apr)), parseISO(apr));
    out.noDia = emA.ags.concat(emA.sups).some(m => m.id === g.id) && emB.ags.concat(emB.sups).some(m => m.id === g.id) && !equipeNoDia(eqA, 'D', parseISO(dia(ult, 1))).ags.some(m => m.id === g.id);
    out.edital = editalHTML(2026, 9).includes('até'); out.ipm = typeof ipmEscalaRows(2026, 9).R === 'object';
    window.sb = window.sb || { paraSb: x => x, paraApp: x => x }; const row = linhasDoEstado(state).config_modulos.get('transferencias'); out.persiste = !!row && row.dados.length === 1;
    const volta = normalizarEstado(JSON.parse(JSON.stringify(state))); out.volta = volta.transferencias.length === 1 && volta.transferencias[0].apresentacao === apr;
    out.erroSobre = trPlano(A, B, '2026-10-30', 3, dia(ult, 1)).erro;
    out.telasDepois = telas();
    formGuarda(g.id); out.hist = /Histórico de equipe/.test(document.getElementById('m-body').innerText); closeModal(); trCancelar(t.id); const f = _confirmFn; _confirmFn = null; closeModal(); f && f();
    out.cancelou = state.transferencias.length === 0 && g.equipeId === A && cods('2026-09-01', '2026-12-31').indexOf('TR') < 0;
    return out; });
  ok(r.dia31 && r.campoVazio && r.previaPerto, 'o último dia informado (31/10) vale; o campo começa vazio e a prévia mostra a escala em volta', r);
  ok(r.trabalha31 && r.nota, 'o guarda trabalha o dia 31/10 na equipe de origem e o edital diz "até 31/10; ... a partir de"', r);
  ok(r.telasAntes.length === 0, 'as telas principais abrem sem erro', r.telasAntes);
  ok(r.curto && r.curto.ok, 'folga curta até a escala nova: cumpre os 3 dias e se apresenta na primeira escala possível', r.curto);
  ok(r.longo && r.longo.ok, 'folga longa: se apresenta na própria escala da equipe nova, sem esperar mais', r.longo);
  ok(r.previa && r.reg, 'o registro pela tela cria a transferência e passa o guarda para a equipe nova', r);
  ok(r.ultimoPlantao, 'o último dia é o último plantão real na equipe de origem até 30/10', r);
  ok(r.passadoIgual, 'a escala até o último plantão é idêntica à de antes da troca', r);
  ok(r.folga, 'os dias de transição são folga marcada como TR', r);
  ok(r.apresenta, 'apresenta-se na primeira escala possível depois dos 3 dias de folga', r);
  ok(r.novaEquipe, 'a partir da apresentação segue o ciclo da equipe nova', r);
  ok(r.membros && r.noDia, 'as equipes mostram o guarda só nas datas em que ele pertenceu a elas', r);
  ok(r.edital && r.ipm, 'edital e IPM do mês da troca mostram as duas equipes e não quebram', r);
  ok(r.persiste && r.volta, 'a transferência é gravada (config_modulos) e volta do servidor', r);
  ok(/antes/.test(r.erroSobre || ''), 'apresentação antes da folga mínima é recusada', r.erroSobre);
  ok(r.telasDepois.length === 0, 'as telas principais abrem sem erro com a transferência registrada', r.telasDepois);
  ok(r.hist && r.cancelou, 'o histórico aparece na ficha e o cancelamento desfaz tudo', r);
  ok(erros.length === 0, 'sem erros de JS', erros);
  await browser.close(); srv.close();
  console.log(`\n${falhas ? '❌' : '✅'} ${passou} verificações passaram, ${falhas} falharam`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO no teste:', e); srv.close(); process.exit(2); });
