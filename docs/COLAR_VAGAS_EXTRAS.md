# Colar vagas de hora extra

**Horas Extras → Colar vagas.** Cole a tabela com as colunas **Data · Horas · Horário** (ex.: `19/11/2026 · 6 · 18H ÀS 00H`), copiada direto do Excel.

- Cada linha vale uma vaga. Linhas iguais (mesma data e horário) viram **uma vaga com várias posições** (4 linhas iguais = 4 vagas).
- As **horas são calculadas pelo horário** (18H ÀS 00H = 6 h; 14H ÀS 22H = 8 h). Se a coluna da tabela divergir, a prévia avisa.
- Vagas que **já existem** (mesma data e horário) não são criadas de novo; colar a mesma tabela duas vezes não duplica.
- O motivo é opcional e vale para todas as vagas criadas. Ninguém é escalado: a escalação continua sendo feita vaga por vaga.
- A criação entra na auditoria.

Teste: `node tests/e2e.extras.js`.
