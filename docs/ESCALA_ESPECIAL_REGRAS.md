# Escala Especial: efetivo mínimo, remanejamentos, GTAM e supervisão

## O que já existia e continua valendo
- **Mínimo por plantão de rua**: parâmetro "Mínimo de agentes por plantão de rua (+ 1 supervisor)" em Mais → Parâmetros. Escalas **novas** nascem com **5**; em uma escala já criada, altere o valor em Parâmetros.
- **Completar sem extra**: PPC remanejado só em dia de trabalho dele, respeitando descanso de 12h (nunca noturno seguido de diurno); COMON, Defesa Civil, Vigias e ROMU não cedem guardas. Extra só aparece quando nada resolve.
- **Supervisão** na ausência do titular: supervisor coringa, supervisor de dia que passa para a noite, adjunto, coordenador (só fora do recesso do expediente) e supervisor de folga como extra.

## O que esta versão acrescenta
- **GTAM dia a dia** (aba Central/ROMU/GTAM): em cada dia escolha *fica no GTAM*, *serviço 07h–19h* ou *serviço 19h–07h* (na viatura, compondo a equipe de rua do turno e contando como agente). Quem tem noturno seguido de diurno não entra. A tela mostra, por dia, os extras sem o GTAM e quantos o GTAM elimina; o botão **Usar o GTAM onde elimina extras** preenche tudo de uma vez e **Tudo no GTAM** desfaz.
- **Totais**: extras *sem o GTAM* e *com o GTAM* (suas escolhas) na aba Resumo, na aba Central/ROMU/GTAM e no PDF.
- **Guarda indicado para supervisionar** (adjunto da própria equipe) conta como um dos agentes do mínimo: com mínimo 5, ficam o indicado **mais 4** agentes. A tela e o PDF avisam quem supervisiona e quantos agentes faltam além dele.
- **Supervisor do ROMU** (como coringa): só aparece para cobrir se a equipe dele tiver 3 ou mais presentes no dia, contando com ele.
- **Coordenação em 22/12**: liberada mesmo dentro do período do expediente (campo `coordDias`, padrão 22/12 do ano da escala).
- **Plantão a plantão** (aba Plantões de rua e PDF): equipe, titulares, folga compensada, PPC, **GTAM na viatura**, supervisor e como foi coberto, total e extras.
- **Remanejamentos por guarda (ordem de serviço)**: aba Plantões de rua e seção própria no PDF, com origem, destino, datas, turno e **retorno à origem ao fim do recesso**.
- **Persistência**: os ajustes da escala (PPC integrado, blocos, coringas, adjuntos, seções do PDF, GTAM e 22/12) agora são gravados no servidor (dentro de `escalas_especiais.minimo`, sem migração); antes só ficavam no cache do navegador.

Teste: `node tests/e2e.escala_especial.js`.
