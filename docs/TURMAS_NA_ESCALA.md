# Turmas de instrução na escala do mês

As turmas cadastradas em **Requalificação** (presenciais, instrução interna e outras; o EAD não entra) aparecem em dois lugares:

- **Tela Mês**: abaixo do quadro, o bloco **Turmas de instrução do mês** lista cada turma com nome, tipo, situação, datas e horário do curso, local e se retira o guarda do serviço de rua. Para cada participante mostra, dia a dia do curso:
  - `dd/mm → folga em dd/mm (troca de jornada)`: o curso caiu numa folga e foi compensado com a folga da data indicada;
  - `dd/mm → banco de horas (Xh)`: curso numa folga, sem compensação marcada ainda;
  - `dd/mm → dentro do serviço`: o curso substitui o plantão do dia;
  - `dd/mm → afastado`: o guarda estava afastado.
  No quadro, o dia do curso aparece como **CUR** e a folga de compensação como **TJ**; ao tocar na célula, o texto cita o nome da turma.
- **Edital do mês (Documentos)**: a seção **Turmas de instrução e requalificação** traz as mesmas informações. Vem marcada por padrão; dá para desmarcar em "Incluir as turmas de instrução do mês no edital".

As datas de compensação vêm das trocas de jornada registradas na própria turma (Requalificação → turma → participante → compensar). Turmas canceladas não aparecem.

Teste: `node tests/e2e.turmas.js`.
