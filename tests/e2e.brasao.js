/* Testes (navegador) da brasão no PDF e na impressão. Dados 100% fictícios; não usa Supabase nem login.
   Rodar:   node tests/e2e.brasao.js
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
  console.log('\nBrasão (logos) nos documentos: tela, impressão e arquivo baixado');
  const r = await page.evaluate(async () => {
    const H = (d, n) => ({ D: { agente: d, supervisor: d }, N: { agente: n, supervisor: n } });
    state = normalizarEstado({ instituicao: 'Teste', equipes: [], guardas: [], ancorasHist: [], ciclos: [{ id: 'c1', nome: 'x', sequencia: ['D', 'N', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) }] });
    _perfilSb = { id: 'u1', nome: 'Teste', login: 'teste', perfil: 'ADMINISTRADOR', ativo: true }; _appPronta = true; _sync.pronto = false;
    const c = document.createElement('canvas'); c.width = 60; c.height = 60; const x = c.getContext('2d'); x.fillStyle = '#c00'; x.fillRect(0, 0, 60, 60); x.fillStyle = '#fff'; x.fillRect(20, 20, 20, 20);
    const png = c.toDataURL('image/png'), webp = c.toDataURL('image/webp', 0.85), out = { tipoWebp: webp.slice(0, 20) };
    const mede = async rotulo => { view = 'docs'; docTab = 'edital'; render(); await new Promise(r => setTimeout(r, 300)); const imgs = [...document.querySelectorAll('#doc-folha img.of-logo')]; const vazio = document.querySelectorAll('#doc-folha .of-logo.vazio').length; out[rotulo] = { imgs: imgs.length, carregadas: imgs.filter(i => i.complete && i.naturalWidth > 0).length, vazio, html: htmlAutonomo().includes('<img class="of-logo"') }; };
    state.logos = { municipio: png, gm: webp }; await mede('comLogos');
    state.logos = { municipio: '', gm: '' }; await mede('semLogos');
    return out; });
  console.log(JSON.stringify(r));
  await page.emulateMedia({ media: 'print' });
  const vis = await page.evaluate(() => { const v = []; document.querySelectorAll('#doc-folha .of-logo').forEach(e => v.push({ cls: e.className, vis: getComputedStyle(e).visibility, disp: getComputedStyle(e).display })); return v; });
  console.log('impressão (sem logos):', JSON.stringify(vis));
  const imp = await page.evaluate(async () => { state.logos = { municipio: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', gm: '' }; view = 'docs'; docTab = 'edital'; render(); const cab = document.querySelector('#doc-folha header.of-cab'), app = document.querySelector('header.brand-bar'); return { cab: cab ? getComputedStyle(cab).display : 'sem cabeçalho', app: app ? getComputedStyle(app).display : 'sem barra', logo: !!document.querySelector('#doc-folha header.of-cab img.of-logo') && getComputedStyle(document.querySelector('#doc-folha img.of-logo')).display }; });
  ok(imp.cab !== 'none' && imp.cab !== 'sem cabeçalho' && imp.logo !== false && imp.logo !== 'none', 'na impressão o cabeçalho oficial (brasões e texto) continua visível', imp);
  ok(imp.app === 'none', 'na impressão a barra superior do app continua escondida', imp);
  ok(r.comLogos.imgs === 2 && r.comLogos.carregadas === 2 && r.comLogos.html, 'com logos enviados as duas imagens aparecem na folha e no arquivo baixado', r.comLogos);
  const av = await page.evaluate(() => { state.logos = { municipio: '', gm: '' }; document.getElementById('toasts').innerHTML = ''; avisoSemLogo(); const a = document.getElementById('toasts').innerText; document.getElementById('toasts').innerHTML = ''; state.logos = { municipio: 'data:image/png;base64,AAAA', gm: '' }; avisoSemLogo(); return { aviso: a, semAvisoComLogo: document.getElementById('toasts').innerText === '' }; });
  ok(/sai sem brasão/.test(av.aviso) && av.semAvisoComLogo, 'ao imprimir ou baixar sem logos o app avisa; com logo não avisa', av);
  ok(erros.length === 0, 'sem erros de JS', erros);
  await browser.close(); srv.close();
  console.log(`\n${falhas ? '❌' : '✅'} ${passou} verificações passaram, ${falhas} falharam`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO no teste:', e); srv.close(); process.exit(2); });
