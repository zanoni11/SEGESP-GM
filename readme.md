# SEGESP-GM

Sistema de Escalas e Gestão Estratégica de Serviço Público — Guarda Municipal de Pinhais.

## Stack

- Frontend: HTML + JavaScript + Tailwind CSS
- Backend: Supabase (PostgreSQL)
- Hospedagem: Netlify

## Como rodar localmente

1. Crie um projeto no Supabase.
2. Rode no SQL Editor, nesta ordem: `supabase/schema.sql`, `supabase/rls_perfis.sql` e `supabase/migracao_002.sql`.
3. Edite `supabase.js` com a URL e a anon key do seu projeto.
4. Crie os logins no painel do Supabase e vincule cada um a um perfil no app (veja `docs/INSTALL.md`).
5. Abra `index.html` com Live Server ou `python -m http.server`.

Os dados do app ficam no Supabase (nada de pessoas fica no código ou no repositório). O navegador guarda só um cache.

## Deploy

Push na branch `main` → Netlify publica automaticamente.

## Time Netlify

`segesp-gm`

## Repositório

github.com/seu-usuario/segesp-gm

## Escala Especial de fim de ano

Veja `docs/ESCALA_ESPECIAL.md` (regras, fluxo, modo de teste local e pontos a confirmar) e `tests/README.md` (como rodar os testes).
Para testar sem Supabase: abra localmente com `?modo=teste` (ex.: `python3 -m http.server 8000` → `http://localhost:8000/index.html?modo=teste`).
