# Escala Especial de Fim de Ano — SEGESP-GM

Organiza o recesso de Natal e Ano Novo dos guardas sem alterar a escala habitual: cada guarda compensa
**3 plantões seguidos do próprio ciclo** e, somando as folgas normais no meio, fica **9 dias seguidos sem serviço**.
Nada é alocado, remanejado nem lançado como hora extra sem autorização.

Código: `escala_especial.js` (regras, sem tela) + bloco "ESCALA ESPECIAL" do `index.html` (telas).

## Fluxo

1. **Nova escala especial** (Escala Especial → + Nova): cria com 20/12 a 08/01 e o rodízio já proposto.
2. **Importar histórico** (Mais ▾): CSV ou planilha `.xlsx` com `matrícula; nome; período; ano`. A matrícula identifica o
   guarda, o nome só confere. A **prévia** mostra registros identificados, matrículas não encontradas ou duplicadas, períodos
   inválidos, guardas sem histórico e conflitos com o que já existe (que **não** é sobrescrito sem você marcar). Dá para corrigir
   na própria prévia e **Reconferir**, ou cancelar.
3. **Parâmetros** (Mais ▾): período, datas dos feriados, **início do recesso por equipe** (19 ou 20/12, e início/término do Ano Novo),
   mínimos da área, VTR, ROMU, GTAM, dias do bloco, grupos fora da escala.
4. **Montar automaticamente**: divide **cada equipe** ao meio (diferença máxima de 1), inverte o ano anterior e escolhe os 3 plantões
   de cada guarda. É determinístico (mesmos dados = mesma proposta). Guardas **fixados** à mão não mudam.
5. **Grade**: toda a operação por data e turno. **Déficits**: o que falta, o que poderia ser remanejado e a necessidade potencial de extra.
6. **Composição**: adjuntos, Central, almoxarifado, PPC, ROMU e GTAM. **Registro**: tudo que foi alterado à mão.
7. **Aprovar** (aba Déficits) só sem pendências. Exportar: **Excel** (botão Excel ▾) e **PDF** (Imprimir / PDF).

## Regras implementadas

| Assunto | Regra |
|---|---|
| Divisão | Por equipe (não pelo efetivo total). Par: metades iguais. Ímpar: diferença de 1 (a metade maior vai para o período que mais precisa pela inversão; empate: ano par → Natal). |
| Rodízio | Natal no ano anterior → Ano Novo; Ano Novo → Natal; sem histórico → completa o equilíbrio. Se a inversão não couber, o guarda **repete** o período **e a situação é sinalizada** (aba Déficits) com alternativas; só deixa de bloquear com decisão registrada. |
| Compensação | 3 plantões **seguidos** do ciclo, a partir do início configurado da equipe. Bloco = do dia seguinte ao último plantão trabalhado até o dia anterior ao próximo plantão. Precisa cobrir os dias do feriado do grupo e ter **9 dias** (menos = inconsistência; mais = aviso). |
| Inconsistência | Mostra nome, matrícula, equipe, período, datas calculadas, regra não atendida e alternativas. A escala **não é "validada"** enquanto houver inconsistência sem decisão. |
| Área | Diurna e noturna separadas. Conta quem está **em serviço, habilitado, não compensando nem afastado**, mais os remanejados **autorizados**. Mínimo padrão 4 por turno (2 VTRs); VTRs = disponíveis ÷ guardas por VTR. |
| PPC | Só apoia a rua/noite com **ajuste de jornada autorizado** (mostra jornada original × proposta, data/horário, equipe apoiada, impacto e conflitos, incluindo descanso de 12 h). |
| ROMU | Linha própria; ideal (padrão 3, do cadastro de regras de efetivo) e **mínimo excepcional de 2**; não usa a regra de 4 da área. |
| GTAM | Linha própria; **dupla = viatura**, **trio = motos**, 1 pode compor a equipe de rua. Composição manual por turno; número errado e integrante em duas composições são apontados antes de validar. |
| Supervisão | Linha separada das VTRs. Titular indisponível → **adjunto habilitado** (só quem foi marcado) ou outro supervisor de folga (serviço extra a autorizar). Substituição com motivo. O adjunto sai da contagem da área. |
| Central | Um servidor por dia, designado por você (ou proposta que você autoriza). Não pode estar também em equipe de rua no mesmo dia. |
| Almoxarifado | **Reforço a autorizar**, nunca alocado sozinho: informe disponibilidade diurna/noturna e datas; a autorização guarda equipe de destino, horário e ressalvas. |
| Extras | "Necessidade potencial de extra" é só sinalização. **Nenhuma hora extra é lançada.** |
| Aprovação | Exige zero pendências (déficits precisam de decisão registrada). Se a escala mudar depois, a aprovação deixa de valer. |

## Onde ficam os dados

Os parâmetros novos (mínimos, início por equipe, adjuntos, Central, reforços, composições, decisões, registro de alterações,
aprovação) ficam em `escalas_especiais.minimo.op` (a coluna `minimo` já é gravada com a escala), e as habilitações por guarda em
`escalas_especiais.g`. **Não há migração de banco** para esta função. Permissões: as mesmas de antes (`especial.editar`: ADMINISTRADOR,
COMANDO e COORDENAÇÃO gravam; os demais só consultam).

## Modo de teste local (sem Supabase, sem login)

Abra o app **localmente** com `?modo=teste`, por exemplo `http://localhost:8000/index.html?modo=teste` (`python3 -m http.server 8000`).

- Só liga em `localhost`, `127.0.0.1` ou arquivo local **e** com o parâmetro. No site publicado nunca liga.
- Entra como "Modo de teste local" (ADMINISTRADOR de teste), **sem usuário autenticado**: os registros dizem isso.
- Guarda os dados só neste navegador (`escalasGM.teste.v1`), fora do cache de produção. Botões no topo: **Carregar exemplo fictício**
  (guardas "GUARDA TESTE nnn", matrículas inventadas) e **Limpar dados de teste**.
- A autenticação de produção não foi alterada.

## Regras que dependem de confirmação administrativa

Foram implementadas de forma configurável, com a interpretação abaixo. Confirme ou ajuste em **Mais ▾ › Parâmetros**:

1. **"Início do recesso" (19 ou 20/12)** = primeira escala compensada permitida (como já era no módulo). O bloco de folga pode começar antes.
2. **9 dias** = no mínimo 9; mais que 9 vira aviso, menos que 9 é inconsistência. (Ciclos como 12x12x60 não permitem 9: aparecem como inconsistência.)
3. **Área** = soma das equipes de rua em serviço no turno; supervisor é contado à parte; 2 guardas por VTR.
4. **Almoxarifado** deixou de contar automaticamente como efetivo da rua (agora é reforço a autorizar). Há um parâmetro para voltar ao comportamento antigo.
5. **ROMU**: ideal 3 / excepcional 2; **GTAM**: dupla 2, trio 3, mínimo 2.
6. **Central**: elegíveis = guardas das equipes do grupo COMON; um servidor por dia, escolhido por você.
7. **Defesa Civil e Vigias** ficam fora das escalas **novas** (inclua em Parâmetros); escalas já existentes não mudam.
8. **Descanso do PPC**: 12 h (constante do app); noite de apoio seguida de serviço diurno sem descanso é conflito.
9. Guardas **fora do rodízio** (afastados, cedidos) não contam na cobertura.

## Limitações conhecidas

- A divisão automática e a escolha de blocos consideram um guarda de cada vez; a otimização global dos extras é a existente ("Otimizar").
- Importação `.xlsx` lê a primeira planilha; se a biblioteca de planilhas não carregou (sem internet), use CSV. O Excel exportado cai para CSV nesse caso.
- Não há chamadas a hora extra: ao decidir "extra", lance a hora extra manualmente no módulo Horas Extras.

## Abas Dia e Equipes

- **Dia**: escolha a data e veja todos os guardas em serviço, com horário, por turno e equipe (recesso, afastados e folga ficam recolhidos). A barra do topo mostra os déficits, guardas faltando, conflitos e propostas, com a variação desde que a escala foi aberta. Propostas do dia podem ser autorizadas ou recusadas ali mesmo.
- **Equipes**: uma equipe por vez. Mostra a divisão Natal × Ano Novo, o início do recesso da equipe (vazio = padrão), cada guarda com seus plantões compensados e a folga contínua, e o calendário colorido da equipe. Botões: **Trocar** (dois guardas da mesma equipe trocam de período; a divisão fica igual e o sistema confere os 9 dias de cada um), **Plantões** (ajuste fino de um guarda) e **Automático desta equipe** (não mexe nas outras).
- **Relatórios por equipe**: folha para imprimir/PDF (só a equipe escolhida), texto para WhatsApp (copiar e colar) e Excel (uma aba da equipe; em Excel ▾ há também "uma aba por equipe").
- **Motivo das alterações** (campo no topo das duas abas): preenchido, as mudanças valem na hora, sem pedir o motivo a cada vez; o motivo e o impacto continuam indo para o Registro. Vazio, o sistema pergunta.
