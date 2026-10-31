/* Testes (navegador) da turmas de instrução na escala do mês. Dados 100% fictícios; não usa Supabase nem login.
   Rodar:   node tests/e2e.turmas.js
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
  console.log('\nTurmas de instrução na escala do mês: data do curso e datas de compensação');
  const r = await page.evaluate(() => {
    const H = (d, n) => ({ D: { agente: d, supervisor: d }, N: { agente: n, supervisor: n } });
    const s = { instituicao: 'Teste', equipes: [{ id: 'e1', nome: 'ALFA', cicloId: 'c1', grupo: 'Operacional', exigeSupervisor: false, efetivoMinimo: 2 }], ancorasHist: [{ equipeId: 'e1', data: '2026-10-01', vigencia: '0000-01-01' }],
      ciclos: [{ id: 'c1', nome: '12x24x12x72', sequencia: ['D', 'N', 'F', 'F', 'F'], horarios: H(['07:00', '19:00'], ['19:00', '07:00']) }],
      guardas: [1, 2, 3].map(n => ({ id: 'g' + n, nomeCompleto: 'GUARDA TESTE 00' + n, nomeGuerra: 'TESTE' + n, matricula: '00' + n, funcao: 'agente', equipeId: 'e1' })) };
    // curso em 03 e 04/11 (folga da ALFA); g1 compensa com folga em 06/11 (troca de jornada); g2 fica no banco de horas; g3 tem o curso num dia de serviço
    s.atividades = [{ id: 'a1', nome: 'Turma de Tiro 01', tipo: 'presencial', inicio: '2026-11-03', fim: '2026-11-04', horaIni: '08:00', horaFim: '17:00', cargaH: 16, vagas: 3, local: 'Sede', retira: true, conta: true, status: 'planejada',
      participantes: [{ guardaId: 'g1', arranjos: { '2026-11-03': { tipo: 'tj', tjId: 'tj1' } } }, { guardaId: 'g2', arranjos: {} }], criadoEm: '' }];
    s.trocasJornada = [{ id: 'tj1', criadoEm: '', guardaId: 'g1', de: '2026-11-06', para: '2026-11-03', turnoNovo: '', atividadeId: 'a1', obs: 'Requalificação: Turma de Tiro 01' }];
    state = normalizarEstado(s); _perfilSb = { id: 'u1', nome: 'Teste', login: 'teste', perfil: 'ADMINISTRADOR', ativo: true }; _appPronta = true; _sync.pronto = false;
    const out = {}, T = turmasDoMes(2026, 10), g1 = getGuarda('g1');
    out.n = T.length; const l1 = T[0] && T[0].linhas.find(x => x.g.id === 'g1'), l2 = T[0] && T[0].linhas.find(x => x.g.id === 'g2');
    out.tj = !!l1 && l1.itens.find(i => i.k === '2026-11-03').estado === 'tj' && l1.itens.find(i => i.k === '2026-11-03').de === '2026-11-06';
    out.banco = !!l2 && l2.itens.every(i => i.estado === 'folga');
    out.fora = turmasDoMes(2026, 11).length === 0 && turmasDoMes(2026, 8).length === 0;
    mesSel = new Date(2026, 10, 1); view = 'mes'; render(); const txt = document.getElementById('main').innerText;
    out.tela = /Turmas de instrução do mês/.test(txt) && /Turma de Tiro 01/.test(txt) && /folga em 06\/11/.test(txt) && /banco de horas/.test(txt) && /03\/11/.test(txt);
    const ed = editalHTML(2026, 10); out.edital = /TURMAS DE INSTRUÇÃO E REQUALIFICAÇÃO/.test(ed) && /Turma de Tiro 01/.test(ed) && /folga em 06\/11/.test(ed);
    out.dica = /compensação do curso "Turma de Tiro 01"/.test(tituloOcorrencia(statusGuarda(g1, parseISO('2026-11-06')))) && /Turma de Tiro 01/.test(tituloOcorrencia(statusGuarda(g1, parseISO('2026-11-03'))));
    out.cur = codigoVisual(statusGuarda(g1, parseISO('2026-11-03'))) === 'CUR';
    state.atividades[0].status = 'cancelada'; out.cancelada = turmasDoMes(2026, 10).length === 0;
    return out; });
  ok(r.n === 1, 'a turma do mês aparece (e some em outros meses)', r);
  ok(r.fora && r.cancelada, 'turmas de outros meses e canceladas não aparecem', r);
  ok(r.tj, 'participante com troca de jornada: curso em 03/11 compensado com folga em 06/11', r);
  ok(r.banco, 'participante sem compensação marcada: banco de horas', r);
  ok(r.tela, 'a tela do mês lista a turma, as datas do curso e as compensações', r);
  ok(r.edital, 'o edital do mês traz as turmas com data e compensação', r);
  ok(r.dica && r.cur, 'as células do curso (CUR) e da folga de compensação explicam a turma', r);
  ok(erros.length === 0, 'sem erros de JS', erros);
  await browser.close(); srv.close();
  console.log(`\n${falhas ? '❌' : '✅'} ${passou} verificações passaram, ${falhas} falharam`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO no teste:', e); srv.close(); process.exit(2); });
