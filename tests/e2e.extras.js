/* Testes (navegador) da vagas de hora extra coladas de uma tabela. Dados 100% fictícios; não usa Supabase nem login.
   Rodar:   node tests/e2e.extras.js
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
  console.log('\nColar vagas de hora extra: data, horas e horário viram vagas (linhas iguais somam posições)');
  const r = await page.evaluate(() => {
    const L = [['19/11/2026', '6', '18H ÀS 00H', 4], ['20/11/2026', '6', '18H ÀS 00H', 4], ['21/11/2026', '6', '18H ÀS 00H', 4], ['22/11/2026', '6', '18H ÀS 00H', 4], ['25/11/2026', '6', '18H ÀS 00H', 4], ['26/11/2026', '6', '18H ÀS 00H', 4], ['27/11/2026', '10', '14H ÀS 22H', 4], ['28/11/2026', '10', '14H ÀS 22H', 4], ['29/11/2026', '10', '14H ÀS 22H', 4]];
    const tabela = 'DATA\tHORAS\tHORÁRIO\n' + L.map(([d, h, t, n]) => Array(n).fill(`${d}\t${h}\t${t}`).join('\n')).join('\n');
    const H = (d, n) => ({ D: { agente: d, supervisor: d }, N: { agente: n, supervisor: n } });
    state = normalizarEstado({ instituicao: 'Teste', equipes: [], guardas: [], ancorasHist: [], ciclos: [{ id: 'c1', nome: 'x', sequencia: ['D', 'N', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) }] });
    _perfilSb = { id: 'u1', nome: 'Teste', login: 'teste', perfil: 'ADMINISTRADOR', ativo: true }; _appPronta = true; _sync.pronto = false;
    const out = {}, p = parseVagasExtras(tabela);
    out.grupos = p.lista.length; out.linhas = p.linhas; out.vagas4 = p.lista.every(x => x.vagas === 4); out.h6 = p.lista.filter(x => x.inicio === '18:00' && x.fim === '00:00').every(x => x.horas === 6) && p.lista.filter(x => x.inicio === '18:00').length === 6;
    out.h8 = p.lista.filter(x => x.inicio === '14:00').length === 3 && p.lista.filter(x => x.inicio === '14:00').every(x => x.horas === 8 && x.difHoras === true);
    mesSel = new Date(2026, 10, 1); view = 'extras'; render(); out.botao = /Colar vagas/.test(document.getElementById('main').innerText);
    formColarVagas(); document.getElementById('cv-txt').value = tabela; document.getElementById('cv-mot').value = 'Cobertura operacional'; previaColarVagas();
    out.previa = /9 vaga\(s\)/.test(document.getElementById('cv-prev').innerText) && /a tabela diz 10h; o app usa 8h/.test(document.getElementById('cv-prev').innerText) && !document.getElementById('cv-ok').disabled;
    confirmarColarVagas();
    out.criou = state.horasExtras.length === 9 && state.horasExtras.reduce((n, h) => n + h.vagas, 0) === 36 && state.horasExtras.every(h => h.escalados.length === 0 && h.motivo === 'Cobertura operacional');
    const h27 = state.horasExtras.find(h => h.data === '2026-11-27'), h19 = state.horasExtras.find(h => h.data === '2026-11-19'); out.horas = h27.horas === 8 && h27.inicio === '14:00' && h27.fim === '22:00' && h19.horas === 6 && h19.inicio === '18:00' && h19.fim === '00:00';
    const volta = normalizarEstado(JSON.parse(JSON.stringify(state))); out.persiste = volta.horasExtras.length === 9 && volta.horasExtras.every(h => h.vagas === 4);
    formColarVagas(); document.getElementById('cv-txt').value = tabela; previaColarVagas(); out.semDuplicar = document.getElementById('cv-ok').disabled === true && /já existe/.test(document.getElementById('cv-prev').innerText); closeModal();
    out.lixo = parseVagasExtras('DATA\tHORAS\tHORÁRIO\n19/11/2026\t6\tsem horário\nlinha solta').ignoradas.length === 2 && parseVagasExtras('19/11/2026\t6\t18:30 às 00:30').lista[0].horas === 6;
    return out; });
  ok(r.grupos === 9 && r.linhas === 36 && r.vagas4, 'as 36 linhas viram 9 vagas com 4 posições cada', r);
  ok(r.h6 && r.h8, 'horas calculadas pelo horário: 18h–00h = 6h e 14h–22h = 8h (a tabela dizia 10h)', r);
  ok(r.botao && r.previa, 'o botão Colar vagas existe e a prévia mostra o aviso das horas', r);
  ok(r.criou && r.horas, 'confirmar cria as vagas (sem ninguém escalado) com motivo, data e horário corretos', r);
  ok(r.persiste, 'as vagas são gravadas e voltam do servidor', r);
  ok(r.semDuplicar, 'colar de novo não duplica as vagas já criadas', r);
  ok(r.lixo, 'linhas sem data ou sem horário são ignoradas; aceita 18:30 às 00:30', r);
  ok(erros.length === 0, 'sem erros de JS', erros);
  await browser.close(); srv.close();
  console.log(`\n${falhas ? '❌' : '✅'} ${passou} verificações passaram, ${falhas} falharam`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO no teste:', e); srv.close(); process.exit(2); });
