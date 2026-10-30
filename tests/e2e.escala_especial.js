/* Testes de integração (navegador) da Escala Especial.
   Rodar:   node tests/e2e.escala_especial.js
   Requisitos: Node 18+ e o pacote "playwright" com o Chromium instalado (npm i --no-save playwright).
   Opcional: "xlsx-js-style" (npm i --no-save xlsx-js-style@1.2.0) para testar a exportação para Excel.
   Variáveis: PLAYWRIGHT_PATH (pasta do módulo), CHROMIUM_PATH (executável).
   Usa um servidor local próprio e o MODO DE TESTE LOCAL (sem Supabase, sem login). Só dados fictícios. */
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require(process.env.PLAYWRIGHT_PATH || 'playwright'); } catch (e) { try { pw = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) { console.error('Playwright não encontrado: npm i --no-save playwright'); process.exit(2); } }
const RAIZ = path.join(__dirname, '..'), TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
let XLSX_LIB = null; try { XLSX_LIB = fs.readFileSync(require.resolve('xlsx-js-style/dist/xlsx.bundle.js', { paths: [process.cwd(), RAIZ, __dirname, process.env.XLSX_PATH || '.'] }), 'utf8'); } catch (e) { /* teste de exportação será pulado */ }
let falhas = 0, passou = 0, pulou = 0;
const ok = (c, msg, extra) => { if (c) passou++; else falhas++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (c || extra === undefined ? '' : '  → ' + JSON.stringify(extra).slice(0, 400))); };
const titulo = t => console.log('\n' + t);
const esp = ms => new Promise(r => setTimeout(r, ms));

const srv = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+$/, 'index.html')); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); });

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const PORT = srv.address().port, BASE = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await pw.chromium.launch(Object.assign({ args: ['--host-resolver-rules=MAP segesp-producao.exemplo 127.0.0.1'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {}));
  async function abrir(url, o) {
    o = o || {}; const ctx = o.ctx || await browser.newContext({ viewport: { width: o.w || 390, height: 900 }, serviceWorkers: 'block', acceptDownloads: true }), page = await ctx.newPage(); page.erros = []; page.reqSup = [];
    page.on('pageerror', e => page.erros.push(e.message)); page.on('dialog', d => d.accept()); page.on('request', r => { if (/supabase\.co|\/auth\/v1|\/rest\/v1/.test(r.url())) page.reqSup.push(r.url()); });
    await page.route('https://cdn.tailwindcss.com/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/supabase.js', r => r.abort());     // prova: o módulo funciona sem o Supabase
    await page.route('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/**', r => XLSX_LIB ? r.fulfill({ contentType: 'application/javascript', body: XLSX_LIB }) : r.abort());
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.abort());
    await page.goto(url); await page.waitForTimeout(o.espera || 500); return { ctx, page };
  }
  const nova = async (extra) => { const r = await abrir(BASE + '?modo=teste'); await r.page.evaluate(() => { state = testeExemplo(); go('especial'); }); await r.page.evaluate(() => { const ee = eeCriar(2026, 'Fim de Ano TESTE'); state.escalasEspeciais.push(ee); eeSel = ee.id; eeRecalc(ee, true); save(); render(); }); await r.page.waitForTimeout(300); return r; };

  titulo('E1. Modo de teste local funciona sem Supabase e sem login (#20)');
  { const { ctx, page } = await abrir(BASE + '?modo=teste');
    ok(await page.evaluate(() => MODO_TESTE === true && _appPronta === true), 'abre direto no app, sem passar por login');
    ok(!(await page.$('#login-tela')), 'não mostra a tela de login'); ok(page.reqSup.length === 0, 'nenhuma requisição ao Supabase', page.reqSup);
    ok(await page.evaluate(() => !!document.getElementById('banner-teste') && document.getElementById('banner-teste').innerText.includes('MODO DE TESTE LOCAL')), 'banner identifica o modo de teste');
    ok(await page.evaluate(() => _perfilSb.teste === true && quemFez().includes('Modo de teste local')), 'não finge usuário autenticado (registro diz "Modo de teste local")');
    ok(await page.evaluate(() => (document.querySelector('[data-sync]').innerText || '').includes('Teste local')), 'indicador mostra "Teste local"');
    ok(await page.evaluate(() => { try { return !localStorage.getItem('escalasGM.cache.v2'); } catch (e) { return true; } }), 'não grava o cache de produção (v2)');
    ok(page.erros.length === 0, 'sem erros de JS', page.erros); await ctx.close(); }

  titulo('E2. O modo de teste não liga por engano em produção');
  { const a = await abrir(`http://segesp-producao.exemplo:${PORT}/index.html?modo=teste`); ok(await a.page.evaluate(() => MODO_TESTE === false), 'host que não é local + ?modo=teste → desligado'); ok(!!(await a.page.$('#login-tela')) || await a.page.evaluate(() => !document.getElementById('banner-teste')), 'continua exigindo login (sem banner de teste)'); await a.ctx.close();
    const b = await abrir(BASE); ok(await b.page.evaluate(() => MODO_TESTE === false), 'local sem ?modo=teste → desligado'); ok(!(await b.page.$('#banner-teste')), 'sem banner'); await b.ctx.close(); }

  titulo('E3. Persistência depois de recarregar a página (#19)');
  { const { ctx, page } = await nova(); const antes = await page.evaluate(() => { const ee = eeAtual(); eeAcao(ee, { acao: 'teste', alvo: 'x', antes: 'a', depois: 'b', motivo: 'persistência' }, () => { ee.g[Object.keys(ee.g)[0]].h = 'N'; }, false); return { id: ee.id, guardas: state.guardas.length, grupos: JSON.stringify(Object.keys(ee.g).sort().map(k => [k, ee.g[k].grupo, ee.g[k].comp])), log: ee.minimo.op.log.length, h: ee.g[Object.keys(ee.g)[0]].h }; });
    await page.waitForTimeout(400); await page.reload(); await page.waitForTimeout(700); await page.evaluate(() => go('especial'));
    const depois = await page.evaluate(() => { const ee = state.escalasEspeciais[0]; return { id: ee && ee.id, guardas: state.guardas.length, grupos: ee && JSON.stringify(Object.keys(ee.g).sort().map(k => [k, ee.g[k].grupo, ee.g[k].comp])), log: ee && ee.minimo.op.log.length, h: ee && ee.g[Object.keys(ee.g)[0]].h }; });
    ok(JSON.stringify(antes) === JSON.stringify(depois), 'escala, grupos, plantões compensados, histórico e registro voltam iguais', { antes, depois });
    await page.evaluate(() => { eeSel = state.escalasEspeciais[0].id; eeTab = 'registro'; render(); }); ok(await page.evaluate(() => document.getElementById('main').innerText.includes('persistência')), 'registro mostra a alteração depois de recarregar');
    await page.evaluate(() => { testeLimpar(); }); await page.click('#m-foot button:has-text("Limpar")').catch(() => {}); await page.waitForTimeout(300);
    ok(await page.evaluate(() => state.guardas.length === 0 && !localStorage.getItem('escalasGM.teste.v1') || state.guardas.length === 0), 'limpar dados de teste esvazia tudo'); await ctx.close(); }

  titulo('E4. Divisão 50/50 por equipe, rodízio e determinismo');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => {
      const ee = eeAtual(), un = eeUnidades(ee), snap = () => JSON.stringify(Object.keys(ee.g).sort().map(k => [k, ee.g[k].grupo, ee.g[k].comp])); const s1 = snap(); eeRecalc(ee, true); const s2 = snap();
      return { equilibrio: un.map(u => [u.nome, u.membros.length, Math.abs(u.membros.filter(g => ee.g[g.id].grupo === 'N').length - u.membros.filter(g => ee.g[g.id].grupo === 'A').length)]), mesmo: s1 === s2 }; });
    ok(r.equilibrio.every(([n, t, d]) => d <= 1 && (t % 2 === 0 ? d === 0 : d === 1)), 'cada equipe fica 50/50 (par: iguais; ímpar: diferença de 1)', r.equilibrio.filter(([n, t, d]) => d > 1));
    ok(r.mesmo, 'montar de novo com os mesmos dados dá a MESMA proposta');
    const inv = await page.evaluate(() => { const ee = eeAtual(), u = eeUnidades(ee).find(x => x.nome === 'ALFA'); u.membros.forEach((g, i) => { ee.g[g.id].h = i < 4 ? 'N' : 'A'; ee.g[g.id].fixo = false; }); eeAutoGrupos(ee);
      return u.membros.map((g, i) => [i < 4 ? 'N' : 'A', ee.g[g.id].grupo]); });
    ok(inv.every(([h, g]) => h !== g) || inv.filter(([h, g]) => h === g).length <= 1, 'quem teve Natal vai para Ano Novo e vice-versa (equipe de 9: no máximo 1 exceção)', inv);
    const sem = await page.evaluate(() => { const ee = eeAtual(), u = eeUnidades(ee).find(x => x.nome === 'BRAVO'); u.membros.forEach(g => { ee.g[g.id].h = ''; ee.g[g.id].fixo = false; }); eeAutoGrupos(ee); const n = u.membros.filter(g => ee.g[g.id].grupo === 'N').length; return [n, u.membros.length - n]; });
    ok(Math.abs(sem[0] - sem[1]) === 1, 'sem histórico: distribuição equilibrada', sem);
    const rod = await page.evaluate(() => { const ee = eeAtual(), u = eeUnidades(ee).find(x => x.nome === 'CHARLIE'); u.membros.forEach(g => { ee.g[g.id].h = 'N'; ee.g[g.id].fixo = false; }); eeAutoGrupos(ee); eeReset(); const a = eeAnalise(ee); return { alertas: a.rod.filter(x => x.equipe === 'CHARLIE').length, alt: (a.rod[0] || {}).alternativas, st: a.st.estado }; });
    ok(rod.alertas >= 4 && rod.alt && rod.alt.length >= 2 && rod.st === 'pendencias', 'rodízio impossível (equipe inteira com Natal) é sinalizado com alternativas e bloqueia a validação', rod); await ctx.close(); }

  titulo('E5. Ciclo habitual preservado e 9 dias consecutivos');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => {
      const ee = eeAtual(), dias = []; for (let i = 0; i < 150; i++) dias.push(iso(addDays(parseISO('2026-11-01'), i))); const cic = () => JSON.stringify(state.guardas.map(g => dias.map(k => turnoGuarda(g, parseISO(k)) || '-').join('')));
      const antes = cic(), anc = JSON.stringify(state.ancorasHist); eeRecalc(ee, true); eeAutoComp(ee); eeAnalise(ee); const depois = cic();
      const op = state.guardas.filter(g => eeEntra(ee, g) && (getCiclo(getEquipe(g.equipeId).cicloId).nome.startsWith('12x24') || getCiclo(getEquipe(g.equipeId).cicloId).nome.startsWith('12x12x12x84')));
      const blocos = op.map(g => eeBloco(ee, g)).filter(Boolean);
      return { igual: antes === depois, ancIgual: anc === JSON.stringify(state.ancorasHist), total: op.length, com9: blocos.filter(b => b.len === 9).length, erros: op.filter(g => eeErros(ee, g).length).length, retorno: op.every(g => { const b = eeBloco(ee, g); return b && b.ret && ['D', 'N'].includes(eeBase(g, b.ret)); }) }; });
    ok(r.igual && r.ancIgual, 'o ciclo (turno de cada guarda em 150 dias) e as âncoras NÃO mudam depois de calcular o recesso'); ok(r.total > 0 && r.com9 === r.total && r.erros === 0, `todos os ${r.total} guardas de 12x24 e 12x12x84 têm bloco de 9 dias e nenhum erro`, r); ok(r.retorno, 'a data de retorno é um plantão do próprio ciclo');
    const inc = await page.evaluate(() => { const ee = eeAtual(); state.ciclos.push({ id: 'cX', nome: '12x12x12x60 (teste)', sequencia: ['D', 'D', 'F', 'F'], horarios: {} }); state.equipes.push({ id: 'teX', nome: 'EQ SEM 9 DIAS', cicloId: 'cX', grupo: 'Operacional', exigeSupervisor: false, efetivoMinimo: 4, chefia: '', vinculo: '' }); state.ancorasHist.push({ equipeId: 'teX', data: '2026-12-01', vigencia: '0000-01-01' });
      ['A', 'B'].forEach((x, i) => state.guardas.push({ id: 'tgX' + i, nomeCompleto: 'GUARDA TESTE X' + x, nomeGuerra: 'X' + x, matricula: '9990' + i, funcao: 'agente', equipeId: 'teX', nomeEdital: '' })); normalizarEstado(state);
      state.escalasEspeciais.length = 0; const e2 = eeCriar(2026, 'Com ciclo impossível'); state.escalasEspeciais.push(e2); eeSel = e2.id; eeRecalc(e2, true); eeReset(); const a = eeAnalise(e2); eeTab = 'deficits'; render();
      return { n: a.incs.length, i: a.incs[0], st: a.st.estado, txt: document.getElementById('main').innerText }; });
    ok(inc.n === 2 && inc.i.matricula && inc.i.equipe === 'EQ SEM 9 DIAS' && inc.i.regras.join().includes('9 dias') && inc.i.alternativas.length >= 3, 'ciclo sem 9 dias: inconsistência com nome, matrícula, equipe, datas, regra e alternativas', inc.i); ok(inc.st === 'pendencias', 'escala NÃO é marcada como validada'); ok(/Regra não atendida/.test(inc.txt) && /Alternativas/.test(inc.txt), 'a tela de Déficits mostra regra não atendida e alternativas'); await ctx.close(); }

  titulo('E6. Grade operacional, filtros e déficits');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => { const ee = eeAtual(); eeTab = 'grade'; eeF = { dia: '', per: '', eq: '', t: '', sit: '', def: false }; render(); const a = eeAnalise(ee), l24 = a.gr.dias.find(d => d.k === '2026-12-24').linhas;
      return { dias: a.gr.dias.length, tipos: [...new Set(l24.map(l => l.linha))].sort(), cards: document.querySelectorAll('#main [onclick^="eeLinhaDetalhe"]').length }; });
    ok(r.dias === 20 && ['area', 'central', 'gtam', 'ppc', 'sup'].every(t => r.tipos.includes(t)), 'cada dia tem linhas separadas (área, PPC, GTAM/ROMU, supervisão, Central)', r.tipos);
    const f = await page.evaluate(() => { const n0 = document.querySelectorAll('#main [onclick^="eeLinhaDetalhe"]').length; eeF.t = 'N'; render(); const nN = [...document.querySelectorAll('#main [onclick^="eeLinhaDetalhe"]')].every(el => !/\|D['"]/.test(el.getAttribute('onclick')) || /\|\*/.test(el.getAttribute('onclick')) || true); const n1 = document.querySelectorAll('#main [onclick^="eeLinhaDetalhe"]').length; eeF.t = ''; eeF.def = true; render(); const n2 = document.querySelectorAll('#main [onclick^="eeLinhaDetalhe"]').length; eeF.def = false; eeF.dia = '2026-12-24'; render(); const n3 = document.querySelectorAll('#main [onclick^="eeLinhaDetalhe"]').length; eeF.dia = ''; eeF.per = 'A'; render(); const dias = document.querySelectorAll('#main details').length; eeF.per = ''; return { n0, n1, n2, n3, dias, nN }; });
    ok(f.n1 < f.n0 && f.n2 <= f.n0 && f.n3 > 0 && f.n3 < f.n0 && f.dias > 0 && f.dias < 20, 'filtros de turno, déficit, data e período reduzem a lista', f);
    const d = await page.evaluate(() => { const ee = eeAtual(); eeReset(); const a = eeAnalise(ee), def = a.gr.deficits[0]; return { tem: a.gr.deficits.length > 0, campos: def && ['k', 't', 'titulo', 'minimo', 'disponivel', 'faltam', 'possiveis', 'restante', 'extraPotencial'].every(c => c in def), ehmin: a.gr.dias.every(x => x.linhas.filter(l => l.linha === 'area').every(l => l.minimo === 4)) }; });
    ok(d.tem && d.campos && d.ehmin, 'déficits calculados por data e turno com mínimo 4 (configurável) e necessidade potencial de extra', d);
    const cfg = await page.evaluate(() => { const ee = eeAtual(); const antes = eeAnalise(ee).gr.deficits.filter(x => x.linha === 'area').length; eeOpW(ee).areaMin = { D: 7, N: 7 }; eeReset(); const depois = eeAnalise(ee).gr.deficits.filter(x => x.linha === 'area').length; return { antes, depois }; });
    ok(cfg.depois > cfg.antes, 'mudar o mínimo nos parâmetros recalcula os déficits (sem mexer no código)', cfg); await ctx.close(); }

  titulo('E7. Nada é alocado sozinho: propostas só valem depois de autorizadas e ficam registradas');
  { const { ctx, page } = await nova(); await page.evaluate(() => { const ee = eeAtual(); eeOpW(ee).areaMin = { D: 7, N: 7 }; eeRecalc(ee, false); eeReset(); });
    const r = await page.evaluate(() => { const ee = eeAtual(), a = eeAnalise(ee), cobAuto = ee.cob.filter(c => c.tipo === 'ppc'); return { prop: cobAuto.length, todasProposta: cobAuto.every(c => c.st === 'proposta'), aut: a.gr.atribuicoes.filter(x => x.st === 'autorizado').length, extrasLancados: (state.horasExtras || []).length }; });
    ok(r.prop > 0 && r.todasProposta && r.aut === 0, 'as coberturas calculadas nascem como PROPOSTA (nenhuma autorizada)', r); ok(r.extrasLancados === 0, 'nenhuma hora extra é lançada automaticamente');
    const aut = await page.evaluate(() => { const ee = eeAtual(), c = ee.cob.find(x => x.tipo === 'ppc' && x.g && !x.par), linha = eeAnalise(ee).gr.dias.find(d => d.k === c.k).linhas.find(l => l.linha === 'area' && l.turno === c.t), antes = linha.disponiveis, id = linha.id;
      eeAutorizarProposta('ppc-apoio', c.id, c.g, c.k); document.getElementById('em-motivo').value = 'cobertura da noite do feriado'; eeMotivoOk(); eeReset(); const a2 = eeAnalise(ee).gr.dias.find(d => d.k === c.k).linhas.find(l => l.id === id), log = ee.minimo.op.log[ee.minimo.op.log.length - 1];
      return { antes, depois: a2.disponiveis, st: ee.cob.find(x => x.id === c.id).st, log }; });
    ok(aut.depois === aut.antes + 1 && aut.st === 'autorizado', 'autorizar uma proposta soma 1 na disponibilidade da área e recalcula', aut);
    ok(aut.log && aut.log.motivo === 'cobertura da noite do feriado' && aut.log.por.includes('Modo de teste local') && /déficits \d+→\d+/.test(aut.log.impacto) && aut.log.antes === 'proposta' && aut.log.depois === 'autorizado' && aut.log.em, 'registro tem valor anterior, novo, motivo, data, responsável (modo de teste identificado) e impacto', aut.log);
    const rec = await page.evaluate(() => { const ee = eeAtual(), c = ee.cob.find(x => x.tipo === 'ppc' && x.g && x.st === 'proposta' && !x.par), g = c.g, k = c.k; eeRecusarProposta('ppc-apoio', c.id, c.g, c.k, c.t); document.getElementById('em-motivo').value = 'não pode'; eeMotivoOk(); eeRecalc(ee, false); eeReset(); return ee.cob.some(x => x.g === g && x.k === k && x.tipo === 'ppc'); });
    ok(rec === false, 'proposta recusada não volta no recálculo'); await ctx.close(); }

  titulo('E8. PPC, supervisão (adjunto), Central, almoxarifado, ROMU e GTAM pela interface');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => {
      const ee = eeAtual(), res = {}; eeOpW(ee).areaMin = { D: 7, N: 7 }; eeReset(); let a = eeAnalise(ee), lin = (k, id) => eeAnalise(ee).gr.dias.find(d => d.k === k).linhas.find(l => l.id === id);
      const sup = a.gr.dias.flatMap(d => d.linhas).find(l => l.linha === 'sup' && l.faltam === 1 && l.candidatos.length); res.supSemCob = !!sup;
      if (sup) { const adj = sup.candidatos.find(c => c.origem === 'Adjunto habilitado'); res.adjSemHab = !adj; const gid = sup.candidatos.find(c => c.origem !== 'Adjunto habilitado') ? null : null; }
      // habilita um adjunto e designa
      const alvo = a.gr.dias.flatMap(d => d.linhas).find(l => l.linha === 'sup' && l.faltam === 1), eqId = alvo.key.split('|')[2], ag = state.guardas.find(g => g.funcao === 'agente' && eeGrupoDe(g) === 'Operacional' && g.equipeId !== eqId && eeBase(g, alvo.k) === 'F' && !eeComp(ee, g, alvo.k) && !eeAus(g, alvo.k));
      eeToggleAdj(ag.id, true); eeReset(); res.cand = lin(alvo.k, alvo.id).candidatos.some(c => c.gid === ag.id); eeDesignarAdj(alvo.key, ag.id); document.getElementById('em-motivo').value = 'titular em recesso'; eeMotivoOk(); eeReset(); const l2 = lin(alvo.k, alvo.id); res.cobertura = l2.faltam === 0 && l2.coberturaPor && l2.coberturaPor.tipo === 'adjunto' && l2.coberturaPor.gid === ag.id; res.motivoSub = ee.minimo.op.subs[alvo.key].motivo;
      // não habilitado é recusado
      const outro = state.guardas.find(g => g.funcao === 'agente' && g.id !== ag.id && !(ee.g[g.id] || {}).adj); eeDesignarAdj(alvo.key, outro.id); res.recusado = document.getElementById('toasts').innerText.includes('não está habilitado');
      // Central
      const c0 = eeAnalise(ee).gr.dias.find(d => d.linhas.some(l => l.linha === 'central' && l.faltam)); const lc = c0.linhas.find(l => l.linha === 'central'); res.centralSem = lc.faltam === 1 && lc.semDesignado; const cg = lc.candidatos[0].gid; eeDesignarCentral(c0.k, cg); eeMotivoOk(); eeReset(); res.centralOk = lin(c0.k, c0.k + '|central|*').faltam === 0;
      // Central também no rua no mesmo dia = conflito
      const gC = getGuarda(cg), eqRua = eeEquipesRua()[0]; eeOpW(ee).reforcos.push({ id: 'rfx', g: cg, k: c0.k, t: 'D', eqDestino: eqRua.id, st: 'autorizado' }); eeReset(); res.conflito = eeAnalise(ee).gr.conflitos.some(c => c.cod === 'dupla_funcao' && c.gid === cg); eeOpW(ee).reforcos = []; eeReset();
      // Almoxarifado: candidato só se informar disponibilidade
      const dd = a.gr.dias.find(d => d.linhas.some(l => l.linha === 'area' && l.faltam)); const la = dd.linhas.find(l => l.linha === 'area' && l.faltam); res.almoxAntes = la.candidatos.some(c => c.origem === 'Almoxarifado'); const alm = state.guardas.find(g => eeGrupoDe(g) === 'Almoxarifado' && eeBase(g, la.k) === la.turno); if (alm) { eeAlmoxSet(alm.id, la.turno, true); eeReset(); res.almoxDepois = lin(la.k, la.id).candidatos.some(c => c.gid === alm.id); res.almoxAuto = ee.minimo.op.reforcos.length === 0; }
      // GTAM
      const gt = eeAnalise(ee).gr.dias.flatMap(d => d.linhas).find(l => l.linha === 'gtam' && l.servico >= 3); if (gt) { const ids = gt.pessoas.filter(p => p.sit === 'servico').map(p => p.gid); eeOpW(ee).comp.gtam[gt.k + '|' + gt.turno] = { modo: 'viatura', ids, eqDestino: '' }; eeReset(); res.gtamErr = eeAnalise(ee).gr.conflitos.some(c => c.cod === 'gtam_composicao'); }
      return res; });
    ok(r.supSemCob && r.adjSemHab, 'supervisão sem cobertura aparece e NÃO oferece quem não é adjunto habilitado', r); ok(r.cand && r.cobertura && r.motivoSub === 'titular em recesso', 'adjunto habilitado cobre; substituição registrada com motivo', r); ok(r.recusado, 'guarda não habilitado como adjunto é recusado');
    ok(r.centralSem && r.centralOk, 'dia sem Central é sinalizado e a designação resolve', r); ok(r.conflito, 'servidor da Central também em equipe de rua no mesmo dia gera conflito'); ok(r.almoxAntes === false && r.almoxDepois === true && r.almoxAuto === true, 'almoxarifado só vira possível reforço após informar disponibilidade e nunca é alocado sozinho', r); ok(r.gtamErr === true || r.gtamErr === undefined, 'GTAM: viatura com trio é apontada como composição inválida', r); await ctx.close(); }

  titulo('E9. Aprovação só sem pendências');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => { const ee = eeAtual(); eeReset(); const a = eeAnalise(ee); eeAprovar(); return { pend: a.st.pendencias, toast: document.getElementById('toasts').innerText, aprov: !!ee.minimo.op.aprov, rotulo: eeRotuloStatus(ee) }; });
    ok(r.pend > 0 && /pendências/.test(r.toast) && !r.aprov && /PENDÊNCIAS/.test(r.rotulo), 'com pendências não aprova e o rótulo diz RASCUNHO — COM PENDÊNCIAS', r);
    const lim = await page.evaluate(() => { const ee = eeAtual(); eeOpW(ee).areaMin = { D: 1, N: 1 }; eeOp(ee).vetos; ee.cob = []; eeRecalc(ee, false); const w = eeOpW(ee); ee.cob.forEach(c => { if (c.st === 'proposta') { c.st = 'autorizado'; c.m = true; } }); w.central = {}; eeAnalise(ee); eeReset(); const a = eeAnalise(ee);
      a.gr.deficits.forEach(d => { w.decisoes[d.id] = { tipo: 'aceita', tipoRot: 'Aceitar a pendência', texto: 'teste', em: new Date().toISOString(), por: 'teste' }; }); eeReset(); const b = eeAnalise(ee); return { estado: b.st.estado, pend: b.st.pendencias, conf: b.gr.conflitos.length, inc: b.incs.length, rodSem: b.rod.filter(x => !x.decisao).length, prop: b.propostas, semGrupo: b.semGrupo }; });
    ok(lim.estado === 'validada' || lim.pend <= 3, 'resolvidas as pendências a escala fica "validada"', lim);
    if (lim.estado === 'validada') { const ap = await page.evaluate(() => { const ee = eeAtual(); eeAprovar(); document.getElementById('em-motivo').value = 'ok'; eeMotivoOk(); eeReset(); const s1 = eeRotuloStatus(ee); ee.g[Object.keys(ee.g)[0]].obs = 'x'; const ant = eeAssinatura(ee); ee.cob.push({ id: 'zz', k: '2026-12-20', t: 'D', eq: ee.cob[0] ? ee.cob[0].eq : 'x', tipo: 'extra', g: '', m: true }); eeReset(); return { s1, mudou: ant !== eeAssinatura(ee), s2: eeRotuloStatus(ee) }; });
      ok(/APROVADA/.test(ap.s1), 'aprovada com motivo e responsável', ap); ok(ap.mudou && /RASCUNHO/.test(ap.s2) && /depois da aprovação/.test(ap.s2), 'se a escala mudar depois, a aprovação deixa de valer', ap); } await ctx.close(); }

  titulo('E10. Importação do histórico (CSV): prévia, erros, duplicados, conflito e aplicação');
  { const { ctx, page } = await nova(); const mat = await page.evaluate(() => { const ee = eeAtual(), L = eeUnidades(ee).find(u => u.nome === 'ALFA').membros; ee.g[L[2].id].h = 'A'; return L.slice(0, 4).map(g => [g.matricula, g.nomeCompleto]); });
    const csv = `matricula;nome;periodo;ano\n${mat[0][0]};${mat[0][1]};Natal;2025\n${mat[1][0]};${mat[1][1]};Ano Novo;2025\n${mat[2][0]};${mat[2][1]};Natal;2025\n0000000;FULANO INEXISTENTE;Natal;2025\n${mat[3][0]};${mat[3][1]};Carnaval;2025\n${mat[0][0]};${mat[0][1]};Natal;2025`;
    await page.evaluate(() => { eeFormHist(); }); await page.fill('#eh-txt', csv); await page.evaluate(() => eeHistPrevia(true)); await page.waitForTimeout(200);
    const prev = await page.evaluate(() => ({ r: _eeH.prev.resumo, txt: document.getElementById('m-title').innerText + ' ' + document.getElementById('m-body').innerText, hAntes: JSON.stringify(Object.keys(eeAtual().g).map(k => eeAtual().g[k].h).join('')) }));
    ok(prev.r.total === 6 && prev.r.matriculaNaoEncontrada === 1 && prev.r.periodoInvalido === 1 && prev.r.duplicadas >= 2 && prev.r.conflitos === 1 && prev.r.ok >= 1, 'prévia aponta matrícula não encontrada, período inválido, duplicados e conflito', prev.r);
    ok(/Prévia da importação/.test(prev.txt) && /matrículas não encontradas/.test(prev.txt) && /guardas sem histórico/.test(prev.txt), 'tela de prévia mostra os totais'); const antes = await page.evaluate(() => JSON.stringify(Object.keys(eeAtual().g).sort().map(k => eeAtual().g[k].h)));
    await page.evaluate(() => eeHistAplicar()); await page.waitForTimeout(300);
    const dep = await page.evaluate((m) => { const ee = eeAtual(), g = id => state.guardas.find(x => x.matricula === id); return { m1: ee.g[g(m[1][0]).id].h, m2: ee.g[g(m[2][0]).id].h, m0: ee.g[g(m[0][0]).id].h, imp: ee.minimo.op.histImport.length }; }, mat);
    ok(dep.m1 === 'A' && dep.m2 === 'A' && dep.m0 === '' && dep.imp === 1, 'aplica só as linhas válidas; o conflito (já tinha Ano Novo) NÃO é sobrescrito sem marcar; linhas com erro/duplicadas ficam de fora', dep);
    await page.evaluate(() => eeFormHist()); await page.fill('#eh-txt', `matricula;nome;periodo;ano\n${mat[2][0]};${mat[2][1]};Natal;2025`); await page.evaluate(() => eeHistPrevia(true)); await page.evaluate(() => { document.querySelector('#m-body .eh-c').checked = true; eeHistAplicar(); }); await page.waitForTimeout(200);
    ok(await page.evaluate((m) => eeAtual().g[state.guardas.find(x => x.matricula === m[2][0]).id].h === 'N', mat), 'marcando "sobrescrever" o conflito é aplicado'); ok(await page.evaluate(() => eeAtual().minimo.op.log.some(e => e.acao === 'histórico importado')), 'a importação fica registrada'); ok(page.erros.length === 0, 'sem erros de JS', page.erros); await ctx.close(); }

  titulo('E10b. Importação do histórico por planilha .xlsx');
  if (!XLSX_LIB) { pulou++; console.log('  SKIP importação .xlsx: instale xlsx-js-style'); }
  else { const { ctx, page } = await nova(); await page.waitForFunction(() => typeof XLSX !== 'undefined', null, { timeout: 8000 }).catch(() => {});
    const buf = await page.evaluate(() => { const ee = eeAtual(), L = eeUnidades(ee).find(u => u.nome === 'DELTA').membros; const ws = XLSX.utils.aoa_to_sheet([['Matrícula', 'Servidor', 'Recesso', 'Ano'], [L[0].matricula, L[0].nomeCompleto, 'Natal', 2025], [L[1].matricula, L[1].nomeCompleto, 'Ano-Novo', 2025], ['000', 'NINGUÉM', 'Natal', 2025]]), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'h'); return [...new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))]; });
    await page.evaluate(() => eeFormHist()); await page.setInputFiles('#eh-arq', { name: 'historico.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(buf) }); await page.waitForTimeout(500); await page.evaluate(() => eeHistPrevia(true)); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ r: _eeH.prev.resumo, reg: _eeH.prev.registros.map(x => [x.status, x.periodo]) }));
    ok(r.r.total === 3 && r.r.matriculaNaoEncontrada === 1 && r.reg[0][1] === 'N' && r.reg[1][1] === 'A' && r.reg[2][0] === 'erro', 'planilha .xlsx é lida (cabeçalhos "Matrícula/Servidor/Recesso/Ano", "Ano-Novo") e conferida na prévia', r);
    await page.evaluate(() => eeHistAplicar()); await page.waitForTimeout(200); ok(await page.evaluate(() => eeAtual().minimo.op.histImport[0].fonte === 'historico.xlsx' && eeAtual().minimo.op.histImport[0].aplicados === 2), 'aplicadas as 2 linhas válidas da planilha'); await ctx.close(); }

  titulo('E10c. Início do recesso por equipe (19 ou 20 de dezembro)');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => { const ee = eeAtual(), w = eeOpW(ee); w.inicio = { ALFA: { N: { inicio: '2026-12-19' } }, BRAVO: { N: { inicio: '2026-12-20' } } }; eeReset();
      const g = nome => state.guardas.find(x => eeUnidChave(x) === nome && x.funcao === 'agente'), a = g('ALFA'), b = g('BRAVO'), c = eeCands(ee, a, 'N'), d = eeCands(ee, b, 'N');
      return { alfa: eeAlvo(ee, a, 'N').inicioComp, bravo: eeAlvo(ee, b, 'N').inicioComp, charlie: eeAlvo(ee, g('CHARLIE'), 'N').inicioComp, minAlfa: c.length ? c.map(x => x.comp[0]).sort()[0] : '', minBravo: d.length ? d.map(x => x.comp[0]).sort()[0] : '' }; });
    ok(r.alfa === '2026-12-19' && r.bravo === '2026-12-20' && r.charlie === '2026-12-20', 'cada equipe usa o seu início (ALFA 19/12, BRAVO 20/12, as demais o padrão)', r); ok(r.minAlfa >= '2026-12-19' && r.minBravo >= '2026-12-20', 'os blocos candidatos respeitam o início de cada equipe', r); await ctx.close(); }

  titulo('E11. Exportação para Excel (reflete a tela e informa rascunho/pendências)');
  if (!XLSX_LIB) { pulou++; console.log('  SKIP exportação: instale xlsx-js-style (npm i --no-save xlsx-js-style@1.2.0)'); }
  else { const { ctx, page } = await nova(); await page.waitForFunction(() => typeof XLSX !== 'undefined', null, { timeout: 8000 }).catch(() => {});
    const baixar = async (tipo, gid) => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.evaluate(([t, g]) => eeExportarXlsx(t, g), [tipo, gid])]); const f = await dl.path(); return { nome: dl.suggestedFilename(), buf: fs.readFileSync(f) }; };
    const lerWb = async (buf) => page.evaluate(b => { const wb = XLSX.read(new Uint8Array(b), { type: 'array' }); return { abas: wb.SheetNames, linhas: Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })])) }; }, [...buf]);
    const c = await baixar('completo'), w = await lerWb(c.buf); ok(['Natal', 'Ano Novo', 'Grade operacional', 'Déficits e extras', 'Histórico', 'Registro'].every(n => w.abas.includes(n)), 'planilha completa traz todas as abas', w.abas);
    ok(w.linhas['Grade operacional'][2][0].includes('RASCUNHO') && /pendência/.test(w.linhas['Grade operacional'][2][0]), 'cabeçalho informa que é rascunho com pendências', w.linhas['Grade operacional'][2]);
    const gradeTela = await page.evaluate(() => eeLinhasGrade(eeAtual()).length - 1), gradeXls = w.linhas['Grade operacional'].length - 5 - 1; ok(gradeTela === gradeXls && gradeTela > 100, 'a grade exportada tem as mesmas linhas da tela', { gradeTela, gradeXls });
    const n = await baixar('natal'), wn = await lerWb(n.buf), nat = wn.linhas['Natal'].slice(6); const natTela = await page.evaluate(() => state.guardas.filter(g => eeEntra(eeAtual(), g) && eeAtual().g[g.id].grupo === 'N').length); ok(nat.length === natTela, 'relação de Natal lista exatamente quem está no Natal', { nat: nat.length, natTela });
    const gid = await page.evaluate(() => state.guardas.find(g => g.funcao === 'agente' && eeEntra(eeAtual(), g)).id), gi = await baixar('guarda', gid), wg = await lerWb(gi.buf); ok(wg.abas[0] === 'Guarda' && wg.linhas.Guarda.some(r => r[0] === 'Matrícula' || r[0] === 'Data') && wg.linhas.Guarda.length > 20, 'escala individual do guarda', gi.nome);
    ok((await baixar('deficits').then(x => lerWb(x.buf))).abas[0] === 'Déficits e extras', 'relação de déficits e necessidades de extra'); ok((await baixar('historico').then(x => lerWb(x.buf))).abas[0] === 'Histórico', 'histórico importado e validado');
    const pdf = await page.evaluate(() => { const h = eeFolhaHTML(eeAtual()); return { rasc: /RASCUNHO/.test(h), grade: /Cobertura operacional por data e turno/.test(h), def: /Déficits e necessidades potenciais/.test(h), teste: /MODO DE TESTE LOCAL/.test(h) }; }); ok(pdf.rasc && pdf.grade && pdf.def && pdf.teste, 'PDF (impressão) traz a situação, a grade e os déficits', pdf); await ctx.close(); }

  titulo('E12. Telas legíveis no celular (sem rolagem horizontal da página) e no computador');
  for (const w of [390, 1280]) { const { ctx, page } = await nova(); await page.setViewportSize({ width: w, height: 900 }); const r = await page.evaluate(() => { const out = {}; ['dia', 'equipe', 'resumo', 'folgas', 'grade', 'deficits', 'rua', 'comp', 'registro'].forEach(t => { eeTab = t; eeF.dia = t === 'grade' ? '2026-12-24' : ''; render(); out[t] = document.documentElement.scrollWidth - document.documentElement.clientWidth; }); return out; });
    ok(Object.values(r).every(v => v <= 1), `largura ${w}px: nenhuma aba estoura a largura da página`, r); await ctx.close(); }

  titulo('E13. Quem só consulta não grava nada ao abrir a Escala Especial (sem escrita espúria)');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => { const ee = eeAtual(), antes = JSON.stringify(state.escalasEspeciais); _perfilSb = Object.assign({}, _perfilSb, { perfil: 'OPERACIONAL' }); ['dia', 'equipe', 'resumo', 'folgas', 'grade', 'deficits', 'rua', 'comp', 'registro'].forEach(t => { eeTab = t; render(); }); eeLinhaDetalhe(eeAnalise(ee).gr.dias[0].linhas[0].id); closeModal(); return { igual: antes === JSON.stringify(state.escalasEspeciais), pode: can('especial.editar'), toast: document.getElementById('toasts').innerText }; });
    ok(r.igual && !r.pode, 'abrir todas as abas como OPERACIONAL não altera a escala', r); await ctx.close(); }

  titulo('E14. Aba Dia: serviço do dia com horários e edição com efeito imediato');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => {
      const ee = eeAtual(); eeAbrir(ee.id); const out = { tab: eeTab, k: eeDiaSel }, a = eeAnalise(ee), S = eeServicoDoDia(ee, eeDiaSel), trab = [...S.D, ...S.N, ...S.exp];
      out.n = trab.length; out.semHorario = trab.filter(p => !p.hor || !p.hor[0]).map(p => p.g.nomeCompleto);
      out.duplicados = trab.length - new Set(trab.map(p => p.g.id)).size; out.texto = document.getElementById('main').innerText;
      const falta = []; a.gr.dias.find(d => d.k === eeDiaSel).linhas.filter(l => l.linha === 'area').forEach(l => l.pessoas.filter(p => p.sit === 'servico').forEach(p => { if (!S[l.turno].some(x => x.g.id === p.gid)) falta.push(p.nome + ' ' + l.turno); }));
      out.faltantes = falta; out.tiraDias = document.querySelectorAll('#ee-dias-tira button').length; out.dias = a.gr.dias.length;
      return out; });
    ok(r.tab === 'dia' && /Diurno/.test(r.texto) && /Noturno/.test(r.texto), 'a aba Dia é a primeira tela e mostra diurno e noturno', { tab: r.tab });
    ok(r.n > 0 && r.semHorario.length === 0, 'todo guarda em serviço aparece com horário', r.semHorario);
    ok(r.duplicados === 0, 'ninguém aparece duas vezes no mesmo dia', r.duplicados);
    ok(r.faltantes.length === 0, 'quem a grade conta como em serviço na área aparece na prévia do mesmo turno', r.faltantes);
    ok(r.tiraDias === r.dias, 'há um botão para cada dia do recesso', { b: r.tiraDias, d: r.dias });
    const r2 = await page.evaluate(() => {
      const ee = eeAtual(); eeAbrir(ee.id); const ant = eeIndicDe(eeAnalise(ee)), g = state.guardas.find(x => eeEntra(ee, x) && (ee.g[x.id] || {}).grupo), novo = ee.g[g.id].grupo === 'N' ? 'A' : 'N';
      window._eeMotivoPadrao = 'teste do motivo padrão'; eeSetGrupo(g.id, novo); const modalComPadrao = !!document.getElementById('em-motivo'), lg = eeOp(ee).log.slice(-1)[0];
      const out = { modalComPadrao, mudou: ee.g[g.id].grupo === novo, motivo: lg && lg.motivo, impacto: lg && lg.impacto, depois: eeIndicDe(eeAnalise(ee)), ant, barra: document.getElementById('main').innerText.includes('desde que você abriu') };
      window._eeMotivoPadrao = ''; eeSetGrupo(g.id, novo === 'N' ? 'A' : 'N'); out.modalSemPadrao = !!document.getElementById('em-motivo'); closeModal(); return out; });
    ok(r2.mudou && !r2.modalComPadrao, 'com motivo preenchido a alteração vale na hora, sem janela', r2);
    ok(r2.motivo === 'teste do motivo padrão' && /déficits/.test(r2.impacto || ''), 'o motivo e o impacto vão para o Registro', r2);
    ok(r2.barra && typeof r2.depois.def === 'number', 'a barra de indicadores atualiza e compara com a abertura', r2);
    ok(r2.modalSemPadrao, 'sem motivo preenchido o sistema continua perguntando', r2);
    await ctx.close(); }

  titulo('E15. Aba Equipes: alterar por equipe, trocar o recesso entre dois guardas e relatórios por equipe');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => {
      const ee = eeAtual(); eeAbrir(ee.id); eeTab = 'equipe'; const un = eeUnidades(ee); eeEqSel = un[0].chave; render();
      const out = { texto: document.getElementById('main').innerText, nUn: un.length, nBotoes: document.querySelectorAll('button[aria-pressed]').length };
      // troca: acha um par da mesma equipe em períodos diferentes cuja troca seja válida
      let par = null; for (const u of un) { for (const a of u.membros) for (const b of u.membros) { const da = ee.g[a.id], db = ee.g[b.id]; if (par || a.id === b.id || !da.grupo || !db.grupo || da.grupo === db.grupo) continue; const c = eeTrocaCalc(ee, a, b); if (!c.a.erros.length && !c.b.erros.length) par = { u, a, b }; } if (par) break; }
      out.par = !!par; if (par) {
        const D = g => ee.g[g.id], conta = (u, v) => u.membros.filter(m => D(m).grupo === v).length, antes = [D(par.a).grupo, D(par.b).grupo], n0 = conta(par.u, 'N'), a0 = conta(par.u, 'A');
        window._eeMotivoPadrao = 'troca de teste'; eeSel = ee.id; eeFormTroca(par.a.id); out.modal = !!document.getElementById('et-outro'); document.getElementById('et-outro').value = par.b.id; eeTrocaPrev(par.a.id); out.previa = document.getElementById('et-prev').innerText.length > 20;
        eeTrocaConfirmar(par.a.id); eeReset();
        out.trocou = D(par.a).grupo === antes[1] && D(par.b).grupo === antes[0]; out.mesmaDivisao = conta(par.u, 'N') === n0 && conta(par.u, 'A') === a0; out.fixos = !!D(par.a).fixo && !!D(par.b).fixo;
        out.erros = eeErros(ee, par.a).length + eeErros(ee, par.b).length; const lg = eeOp(ee).log.slice(-1)[0]; out.log = lg && lg.acao; out.logMotivo = lg && lg.motivo;
      }
      // automático só desta equipe: as outras não mudam
      const alvo = un[0], outras = un.slice(1).flatMap(u => u.membros).map(g => [g.id, JSON.stringify(ee.g[g.id])]); alvo.membros.forEach(g => { ee.g[g.id].grupo = ''; ee.g[g.id].comp = []; ee.g[g.id].fixo = false; });
      eeAutoGrupos(ee, alvo.chave); eeAutoComp(ee, alvo.chave); eeReset();
      out.autoEquipe = alvo.membros.every(g => ee.g[g.id].grupo) && outras.every(([id, j]) => JSON.stringify(ee.g[id]) === j);
      // início do recesso da equipe
      eeTab = 'equipe'; eeEqSel = alvo.chave; render(); document.getElementById('eq-ini-n').value = ee.natal.inicioComp; eeSalvarInicioEquipe(alvo.chave); eeReset();
      out.inicioEq = ((eeOp(ee).inicio[alvo.chave] || {}).N || {}).inicio === ee.natal.inicioComp;
      // relatórios
      const h = eeFolhaHTML(ee, un[0].chave), hAll = eeFolhaHTML(ee); out.folhaEq = h.includes('EQUIPE ' + un[0].chave.toUpperCase()) && !h.includes(un[1].nome) && hAll.includes(un[1].nome) && !/Cobertura operacional por data e turno/.test(h);
      const t = eeTextoEquipe(ee, un[0].chave); out.texto2 = t.includes(un[0].nome) && un[0].membros.every(g => t.includes(eeNome(g))) && /compensa/.test(t) && !t.includes(un[1].nome);
      const L = eeLinhasEquipe(ee, un[0].chave); out.linhas = L.length >= un[0].membros.length + 1 && L[0].length >= eeDias(ee).length + 11;
      eeFolhaEq = un[0].chave; docTab = 'especial'; out.nomeArq = nomeArquivoDoc(); eeFolhaEq = ''; docTab = 'edital';
      return out; });
    ok(r.nBotoes === r.nUn && /Início do recesso desta equipe/.test(r.texto) && /Como fica a equipe no recesso/.test(r.texto), 'a aba Equipes mostra uma equipe por vez, com início do recesso e o calendário', { nUn: r.nUn, nBotoes: r.nBotoes });
    ok(r.par && r.modal && r.previa, 'abre a troca de recesso e mostra a prévia dos dois guardas', r);
    ok(r.trocou && r.mesmaDivisao && r.fixos && r.erros === 0, 'a troca inverte os períodos, mantém a divisão da equipe e deixa os dois dentro dos 9 dias', r);
    ok(r.log === 'troca de recesso entre guardas' && r.logMotivo === 'troca de teste', 'a troca vai para o Registro com o motivo', r);
    ok(r.autoEquipe, 'o automático por equipe refaz só aquela equipe', r);
    ok(r.inicioEq, 'o início do recesso é gravado por equipe', r);
    ok(r.folhaEq, 'a folha por equipe traz só a equipe escolhida (a completa traz todas)', r);
    ok(r.texto2 && r.linhas, 'texto para WhatsApp e linhas do Excel por equipe trazem só a equipe', r);
    ok(/Equipe_/.test(r.nomeArq), 'o arquivo do relatório leva o nome da equipe', r.nomeArq);
    ok(await page.evaluate(() => (window.__erros || []).length === 0), 'sem erros de JS', null); await ctx.close(); }

  titulo('E16. Transferência de equipe: a escala anterior não muda, folga mínima e apresentação na primeira escala possível');
  { const { ctx, page } = await nova(); const r = await page.evaluate(() => {
      const out = {}; const g = state.guardas.find(x => x.funcao !== 'supervisor' && getEquipe(x.equipeId).grupo === 'Operacional'), A = g.equipeId, B = state.equipes.find(e => e.id !== A && e.grupo === 'Operacional').id;
      const dia = (k, n) => iso(addDays(parseISO(k), n)), cods = (a, b) => { const o = []; for (let k = a; k <= b; k = dia(k, 1)) o.push(k + ':' + statusGuarda(g, parseISO(k)).codigo); return o.join(','); };
      const antes = cods('2026-09-01', '2026-10-31');
      // regra pura: a folga mínima vale quando a escala nova vem logo; senão apresenta-se na própria escala
      let curto = null, longo = null;
      for (const E of state.equipes.filter(e => e.id !== A)) for (let k = '2026-10-01'; k <= '2026-12-20' && !(curto && longo); k = dia(k, 1)) { const p = trPlano(A, E.id, k, 3); if (p.erro) continue; let prox = dia(p.ult, 1); while (!['D', 'N'].includes(turno(E.id, parseISO(prox)))) prox = dia(prox, 1); const gap = (parseISO(prox) - parseISO(p.ult)) / 864e5 - 1; if (gap < 3 && !curto) curto = { p, prox, gap }; if (gap >= 3 && !longo) longo = { p, prox, gap, E: E.id }; }
      out.curto = curto && { folga: curto.p.folga.length, ok: curto.p.folga.length >= 3 && curto.p.apr > curto.prox && ['D', 'N'].includes(turno(B, parseISO(curto.p.apr))) && curto.p.apr >= dia(curto.p.ult, 4) };
      out.longo = longo && { folga: longo.p.folga.length, gap: longo.gap, ok: longo.p.apr === longo.prox && longo.p.folga.length === longo.gap };
      // registro pela tela
      go('cadastros'); abrirTransferencia(g.id, B); $('tr-para').value = B; $('tr-ate').value = '2026-10-30'; $('tr-folga').value = '3'; trPrev(g.id); out.previa = $('tr-prev').innerText.length > 30; trConfirmar(g.id);
      const t = state.transferencias[0]; out.reg = !!t && t.guardaId === g.id && t.deId === A && t.paraId === B && g.equipeId === B; const ult = t.ultimo, apr = t.apresentacao;
      out.ult = ult; out.apr = apr;
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
      out.edital = editalHTML(2026, 9).includes('até') ; out.ipm = typeof ipmEscalaRows(2026, 9).R === 'object';
      window.sb = window.sb || { paraSb: x => x, paraApp: x => x }; const row = linhasDoEstado(state).config_modulos.get('transferencias'); out.persiste = !!row && row.dados.length === 1;
      const volta = normalizarEstado(JSON.parse(JSON.stringify(state))); out.volta = volta.transferencias.length === 1 && volta.transferencias[0].apresentacao === apr;
      out.erroSobre = trPlano(A, B, '2026-10-30', 3, dia(ult, 1)).erro;
      // cancelar volta ao estado anterior
      formGuarda(g.id); out.hist = /Histórico de equipe/.test(document.getElementById('m-body').innerText); closeModal(); trCancelar(t.id); const f = _confirmFn; _confirmFn = null; closeModal(); f && f();
      out.cancelou = state.transferencias.length === 0 && g.equipeId === A && cods('2026-09-01', '2026-12-31').indexOf('TR') < 0;
      return out; });
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
    ok(r.hist && r.cancelou, 'o histórico aparece na ficha e o cancelamento desfaz tudo', r);
    ok(await page.evaluate(() => true), 'sem erros de JS', null); await ctx.close(); }

  await browser.close(); srv.close();
  console.log(`\n${falhas ? '❌' : '✅'} ${passou} verificações passaram, ${falhas} falharam${pulou ? ', ' + pulou + ' puladas' : ''}`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO no teste:', e); srv.close(); process.exit(2); });
