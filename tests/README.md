# Testes

Dados 100% fictícios. Nada aqui usa Supabase nem dados reais.

## Regras (rápidos, só Node 18+)

    node --test tests/motor.test.js

Cobre o motor `escala_especial.js`: divisão por equipe (par/ímpar), rodízio, histórico, início em 19/20, 9 dias consecutivos,
ciclo sem 9 dias, déficits diurno/noturno, ROMU, GTAM, conflito de função, adjunto, Central, importação (matrícula inválida,
duplicados) e que o ciclo habitual não é alterado.

## Integração no navegador (modo de teste local)

    npm i --no-save playwright              # e o Chromium do Playwright
    npm i --no-save xlsx-js-style@1.2.0     # opcional: testa a exportação/importação de Excel
    node tests/e2e.escala_especial.js

Sobe um servidor local, abre o app com `?modo=teste` (sem Supabase, sem login) e confere: persistência após recarregar, o modo de
teste não ligar em produção, 50/50 por equipe, ciclo preservado, grade e filtros, propostas só valendo depois de autorizadas,
registro com motivo e impacto, supervisão/adjunto/Central/almoxarifado/GTAM, aprovação, importação CSV e XLSX, exportação,
largura das telas (celular e computador) e que quem só consulta não grava nada.
Variáveis: `PLAYWRIGHT_PATH`, `CHROMIUM_PATH`, `XLSX_PATH`.
