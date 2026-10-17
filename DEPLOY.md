# Deploy — SEGESP-GM

Guia para publicar o sistema em produção (Netlify).

---

## Pré-requisitos

- Repositório no GitHub: `segesp-gm`
- Conta gratuita no [Netlify](https://netlify.com)
- Time criado no Netlify: `segesp-gm`

---

## 1. Conectar GitHub ao Netlify

1. Acesse [app.netlify.com](https://app.netlify.com) e faça login.
2. No painel do time `segesp-gm`, clique em **Add new site** → **Import an existing project**.
3. Escolha **GitHub**.
4. Autorize o Netlify a acessar seus repositórios.
5. Selecione o repositório **segesp-gm**.
6. Configure:
   - **Branch to deploy:** `main`
   - **Build command:** (deixe vazio)
   - **Publish directory:** (deixe vazio ou `/`)
7. Clique em **Deploy site**.

Aguarde ~30 segundos. O Netlify gera uma URL tipo:
