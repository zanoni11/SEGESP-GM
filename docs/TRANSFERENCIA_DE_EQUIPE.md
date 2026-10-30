# Transferência de guarda entre equipes

## Como usar

1. **Cadastros → Guardas →** abra a ficha do guarda, mude a **Equipe** e salve.
2. O sistema abre a janela **Transferir**: informe o último dia em que ele trabalha na equipe atual (ex.: 31/10; o campo começa vazio e a prévia mostra a escala da equipe em volta do dia) e, se quiser, a folga mínima (padrão 3 dias), a data de apresentação e o motivo ou ato.
3. A prévia mostra: ① o último plantão real na equipe de origem; ② a folga de transição; ③ o dia em que ele se apresenta na equipe nova. Confirme em **Registrar transferência**.

## Regra do cálculo

- **Último plantão** = o último dia de serviço da equipe de origem até a data informada (se o dia informado for folga da equipe, vale o plantão anterior).
- **Folga mínima** = 3 dias seguidos depois do último plantão (configurável na janela).
- **Apresentação** = a primeira escala da equipe nova em que a folga mínima já foi cumprida. Se a escala da equipe nova vier antes dos 3 dias, ele folga os 3 dias e se apresenta na primeira escala possível depois; se vier depois, ele se apresenta nela (a folga fica do tamanho do intervalo).

## O que muda na escala

- Até o último plantão: **nada muda**. O guarda continua aparecendo na equipe de origem (escala, boletim, efetivo, edital, IPM e Supervisão do período).
- Entre o último plantão e a apresentação: folga de transição, com código **TR** e a explicação ao tocar no dia.
- Último plantão e apresentação ficam marcados nas células (**ÚLT** e **APR**).
- A partir da apresentação: segue o ciclo da equipe nova.
- No edital e no IPM do mês da troca o guarda aparece nas duas equipes, com a observação das datas.

## Onde fica registrado

- A transferência é gravada junto com os ajustes de módulos (tabela `config_modulos`, id `transferencias`). **Não exige migração do banco.** Quem pode gravar é o mesmo grupo que edita equipes e guardas (ADMINISTRADOR, COMANDO e COORDENAÇÃO).
- O cadastro do guarda passa a mostrar a **equipe nova**. O histórico aparece na ficha ("Histórico de equipe"), onde a última transferência pode ser cancelada para desfazer um registro errado.
- A ação entra no registro de auditoria.

## Limites conhecidos

- Remover o guarda de uma equipe sem indicar a nova continua valendo para todas as datas.
- Em **Cadastros → Equipes → adicionar guardas** (seleção em lote), mover quem já tem equipe também vale para todas as datas; serve para corrigir cadastro errado. Para trocar sem alterar o passado, use a ficha do guarda.
- Requalificação, contagem de horas extras por equipe e Escala Especial usam a equipe atual (a Escala Especial usa o turno por data, que já considera a transição).
- O "último plantão" segue o ciclo da equipe; férias e afastamentos do guarda não deslocam a data.

## Testes

`node tests/e2e.transferencia.js` (Playwright; dados fictícios, sem Supabase): cobre a folga curta e a longa, o registro pela tela, a escala anterior idêntica, a marca TR, a apresentação, o edital e o IPM do mês, a gravação em `config_modulos`, o cancelamento e a abertura das telas principais.
