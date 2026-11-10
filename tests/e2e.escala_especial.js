/* Testes (navegador) da Escala Especial: GTAM dia a dia, remanejamentos e mínimo de agentes. Dados 100% fictícios; não usa Supabase nem login.
   Rodar:   node tests/e2e.escala_especial.js
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
  console.log('\nEscala Especial: GTAM dia a dia, extras sem/com GTAM, remanejamentos, supervisor da equipe e persistência');
  const r = await page.evaluate(() => {
    const H = (d, n) => ({ D: { agente: d, supervisor: d }, N: { agente: n, supervisor: n } });
    const s = { instituicao: 'Teste', equipes: [], guardas: [], ancorasHist: [], feriados: [],
      ciclos: [{ id: 'c1', nome: '12x24x12x72', sequencia: ['D', 'N', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) },
        { id: 'c4', nome: '12x12x12x84', sequencia: ['D', 'D', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) },
        { id: 'cg', nome: '10x14x10x86', sequencia: [...Array(10).fill('D'), ...Array(14).fill('F')], horarios: H(['08:00', '18:00'], ['19:00', '07:00']) }] };
    let n = 0; const eq = (id, nome, cicloId, grupo, anc, ag, sup) => { s.equipes.push({ id, nome, cicloId, grupo, exigeSupervisor: !!sup, efetivoMinimo: 2 }); s.ancorasHist.push({ equipeId: id, data: anc, vigencia: '0000-01-01' });
      for (let i = 0; i < ag + (sup ? 1 : 0); i++) { n++; s.guardas.push({ id: 'g' + n, nomeCompleto: 'GUARDA TESTE ' + String(n).padStart(3, '0'), nomeGuerra: 'T' + n, matricula: String(1000 + n), funcao: sup && i === 0 ? 'supervisor' : 'agente', equipeId: id }); } };
    ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECO'].forEach((nm, i) => eq('o' + i, nm, 'c1', 'Operacional', '2026-12-0' + (i + 1), 4, true));
    eq('p1', 'PPC ALFA', 'c4', 'PPC', '2026-12-01', 3, false); eq('p2', 'PPC BRAVO', 'c4', 'PPC', '2026-12-03', 3, false);
    eq('r1', 'ROMU ALFA', 'c4', 'ROMU', '2026-12-01', 3, true); eq('gt', 'GTAM', 'cg', 'GTAM', '2026-12-18', 4, false);
    state = normalizarEstado(s); _perfilSb = { id: 'u1', nome: 'Teste', login: 'teste', perfil: 'ADMINISTRADOR', ativo: true }; _appPronta = true; _sync.pronto = false;
    let diaN = null; const out = {}, ee = eeCriar(2026, 'Teste'); state.escalasEspeciais.push(ee); eeSel = ee.id; ee.ppcIntegrado = false; eeRecalc(ee, true); eeTab = 'moto';
    out.minimo = ee.minimo.agentes === 5 && JSON.stringify(ee.coordDias) === '["2026-12-22"]' && eeCoordPode(ee, '2026-12-22');
    const ext = () => eeRuaDados(ee).reduce((a, x) => a + x.ex.length, 0);
    const B = eeGtamBase(ee); out.base = B.tot; out.atual0 = ext(); out.baseIgual = B.tot === out.atual0;
    // um dia com GTAM presente e extra a eliminar
    const dias = eeDias(ee), dia = dias.find(k => (B.ex[k + '|D'] || 0) > 0 && eeGtamPres(ee, k).length), t = dia && 'D';
    out.dia = dia || null;
    if (dia) { const antes = eeRuaDados(ee).find(x => x.k === dia && x.t === 'D'), prev = antes.ex.length; eeGtamSet(dia, 'D'); const dep = eeRuaDados(ee).find(x => x.k === dia && x.t === 'D');
      out.gtamEntrou = dep.gt.length > 0 && dep.gt.length === eeGtamPres(ee, dia).filter(g => eeGtamPode(ee, g, dia, 'D')).length; out.extrasMenos = dep.ex.length < prev || prev === 0; out.elimina = eeGtamElimina(ee, eeGtamBase(ee), dia, 'D') > 0;
      out.totalConta = dep.total === dep.pres.length + dep.ppc.length + dep.gt.length + dep.ex.length; out.codigo = eeCod(ee, dep.gt[0] && getGuarda(dep.gt[0].g), dia).c === 'GT';
      out.persiste = (() => { window.sb = window.sb || { paraSb: o => { const r = {}; for (const k in o) r[k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = o[k]; return r; }, paraApp: o => { const r = {}; for (const k in o) r[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = o[k]; return r; } };
        const L = linhasDoEstado(state), row = L.escalas_especiais.get(ee.id), d = TABS.find(x => x.t === 'escalas_especiais'), volta = d.para(JSON.parse(JSON.stringify(row)));
        return !!row.minimo.ext && row.minimo.ext.gtamDia[dia] === 'D' && volta.gtamDia[dia] === 'D' && volta.ppcIntegrado === false && !('ext' in volta.minimo) && volta.minimo.agentes === 5; })();
      const rem = eeRemanejamentos(ee); out.remanejados = rem.some(x => x.itens && x.itens.some(i => i.rot === 'GTAM na viatura' && i.k === dia)) && rem.every(x => x.retorno === ee.fim || x.integrado);
      // noturno seguido de diurno: o GTAM de ciclo diurno seguido não pode ir para a noite
      diaN = dias.find(k => eeGtamPres(ee, k).length && eeGtamPres(ee, k).some(g => !eeGtamPode(ee, g, k, 'N'))); out.regraNoite = !diaN || eeGtamPres(ee, diaN).filter(g => !eeGtamPode(ee, g, diaN, 'N')).every(g => { eeGtamSet(diaN, 'N'); const ok = !eeRuaDados(ee).flatMap(x => x.gt).some(c => c.g === g.id && c.k === diaN); eeGtamSet(diaN, ''); return ok; });
      eeGtamSet(dia, ''); out.volta = ext() === out.base;
    }
    eeGtamSugerir(); const apos = ext(); out.aposSugerir = apos; out.diasGtam = Object.keys(ee.gtamDia).length; out.diaNoite = diaN || null; out.sugerir = apos <= out.base && Object.keys(ee.gtamDia).every(k => eeGtamElimina(ee, B, k, ee.gtamDia[k]) > 0); out.sugerirMenos = apos < out.base || out.base === 0; eeGtamLimpar(); out.limpar = Object.keys(ee.gtamDia).length === 0 && ext() === out.base;
    // tela e PDF
    view = 'especial'; render(); const tx = document.getElementById('main').innerText; out.telaMoto = /GTAM dia a dia/.test(tx) && /sem o GTAM/.test(tx);
    eeGtamSugerir(); const html = eeFolhaHTML(ee); out.pdf = /Remanejamentos por guarda/.test(html) && /GTAM \(viatura\)/.test(html) && /sem o GTAM <b>\d+<\/b> · com o uso do GTAM escolhido <b>\d+<\/b>/.test(html); eeGtamLimpar();
    eeTab = 'resumo'; render(); out.resumo = /extras sem o GTAM/.test(document.getElementById('main').innerText) && /extras com o GTAM/.test(document.getElementById('main').innerText);
    // guarda da própria equipe indicado para supervisionar não conta como agente
    const S = eeRuaBase(ee).find(x => x.supTit && x.pres.length), adj = S && S.pres[0];
    if (S) { const antes = eeRuaDados(ee).find(x => x.key === S.key); ee.adjuntos = [adj.id]; ee.cob.push({ id: 'cb_t', k: S.k, t: S.t, eq: S.e.id, tipo: 'sup', g: adj.id, m: true, adj: true }); const dep = eeRuaDados(ee).find(x => x.key === S.key);
      out.supAgente = dep.supAg.length === 1 && dep.supAg[0].id === adj.id && !dep.pres.includes(adj) && !dep.folga.includes(adj) && dep.pres.length === antes.pres.length - 1 && dep.total === antes.total && dep.falta === antes.falta; ee.cob = ee.cob.filter(c => c.id !== 'cb_t'); }
    // supervisor do ROMU (coringa) só cobre se a equipe dele tiver 3 ou mais presentes, contando com ele
    { const rs = state.guardas.find(g => g.equipeId === 'r1' && g.funcao === 'supervisor'); ee.coringas = [rs.id];
      const alvo = eeRuaBase(ee).find(x => x.supTit && ['D', 'N'].includes(eeBase(rs, x.k)) && !eeComp(ee, rs, x.k) && eeDescansoOK(ee, rs, x.k, x.t, { troca: true }) && state.guardas.filter(g => g.equipeId === 'r1' && ['D', 'N'].includes(eeBase(g, x.k)) && !eeComp(ee, g, x.k) && !eeAus(g, x.k)).length >= 3);
      out.romuAlvo = !!alvo; if (alvo) { ee.g[alvo.sup.id].comp = [alvo.k];
        const tem = () => { eeFormPlantao(alvo.key); const o = document.getElementById('ep-sup'), v = !!o && [...o.options].some(x => x.value === rs.id); closeModal(); return v; };
        out.romu3 = tem(); const ags = state.guardas.filter(g => g.equipeId === 'r1' && g.id !== rs.id && ['D', 'N'].includes(eeBase(g, alvo.k))); ags.slice(0, Math.max(0, ags.length - 1)).forEach(g => { ee.g[g.id].comp = [alvo.k]; }); out.romu2 = !tem(); } }
    out.erroTela = document.getElementById('main').innerText.length > 100;
    return out; });
  console.log(JSON.stringify(r));
  ok(r.minimo, 'escala nova: mínimo de 5 agentes e coordenação liberada em 22/12', r);
  ok(r.baseIgual, 'sem escolha de GTAM, extras com e sem o GTAM são iguais', r);
  ok(r.dia && r.gtamEntrou && r.extrasMenos && r.elimina && r.totalConta && r.codigo, 'escolher serviço 07h–19h coloca o GTAM do dia na equipe de rua e reduz extras', r);
  ok(r.persiste, 'a escolha do GTAM e os ajustes da escala vão para o servidor (minimo.ext) e voltam', r);
  ok(r.remanejados, 'a lista de remanejamentos mostra o GTAM no dia, com retorno à origem no fim do recesso', r);
  ok(r.regraNoite && r.volta, 'noturno seguido de diurno é barrado e voltar ao GTAM devolve os extras', r);
  ok(r.sugerir && r.sugerirMenos && r.limpar, 'sugerir usa o GTAM só onde elimina extras; limpar volta tudo ao GTAM', r);
  ok(r.telaMoto && r.resumo && r.pdf, 'tela, resumo e PDF mostram extras sem e com o GTAM, a coluna GTAM e os remanejamentos', r);
  ok(r.supAgente, 'guarda da equipe indicado para supervisionar conta como um dos agentes (indicado + os demais: 1 + 4)', r);
  ok(r.romuAlvo && r.romu3 && r.romu2, 'supervisor do ROMU aparece para cobrir com 3 ou mais na equipe e some com menos', r);
  ok(erros.length === 0, 'sem erros de JS', erros);
  await browser.close(); srv.close();
  console.log(`\n${falhas ? '❌' : '✅'} ${passou} verificações passaram, ${falhas} falharam`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO no teste:', e); srv.close(); process.exit(2); });
