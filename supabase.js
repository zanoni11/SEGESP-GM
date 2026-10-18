/* ============================================================
   SEGESP-GM — Conexão com Supabase
   ============================================================
   Sistema de Escalas e Gestão Estratégica de Serviço Público
   Guarda Municipal de Pinhais — PR

   Este arquivo contém:
   - Conexão com o Supabase
   - Login / logout
   - Helpers para ler / escrever dados
   - Conversão entre snake_case (banco) e camelCase (app)

   
   ============================================================ */

// ⚠️ SUBSTITUA pelos valores do SEU projeto:
// Supabase → Settings → API → Project URL / anon public key
const SUPABASE_URL = 'https://kuuqsqgeulltrdcbdget.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dXFzcWdldWxsdHJkY2JkZ2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMzQ5ODYsImV4cCI6MjEwNzgxMDk4Nn0.kR9zHl2UDL2VZNu7fdIzQ-bpsLCgpWhaJTLjLjeSbaE';

// SDK do Supabase carregado via CDN (ESM)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Cliente global
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */

async function sbUsuarioAtual() {
  const { data: { user } } = await supa.auth.getUser();
  return user;
}

// Linha do usuário logado na tabela usuarios (null se não existir). Erros de rede/servidor são lançados.
async function sbPerfilAtual() {
  const user = await sbUsuarioAtual();
  if (!user) return null;
  const { data, error, status } = await supa.from('usuarios').select('*').eq('id', user.id).maybeSingle();
  if (error) throw erroSb('Erro ao buscar perfil', error, status);
  return data || null;
}

async function sbLogin(email, senha) {
  const { data, error } = await supa.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha
  });
  if (error) throw new Error(error.message);
  return data.user;
}

async function sbLogout() {
  await supa.auth.signOut();
}

/* ============================================================
   ERROS
   ============================================================ */

// Erro com o código do Postgres/PostgREST (code) e o status HTTP, para o app decidir o que fazer
// (permissão negada, sem rede, dado recusado pelo banco...).
function erroSb(prefixo, error, status) {
  const e = new Error(`${prefixo}: ${error.message}`);
  e.code = error.code || '';
  e.status = status || 0;
  e.detalhe = error.details || '';
  return e;
}

/* ============================================================
   LEITURA
   ============================================================ */

// Lê a tabela inteira em páginas de 1000 (limite do Supabase por consulta).
// opcoes: { desc: true } ordena do maior para o menor; { limite: N } para ao juntar N linhas.
async function sbLer(tabela, ordem, opcoes = {}) {
  const passo = 1000, limite = opcoes.limite || Infinity, tudo = [];
  let de = 0;
  while (tudo.length < limite) {
    const n = Math.min(passo, limite - tudo.length);
    let q = supa.from(tabela).select('*').order(ordem || 'id', { ascending: !opcoes.desc });
    if (ordem && ordem !== 'id') q = q.order('id');   // desempate estável entre as páginas
    const { data, error, status } = await q.range(de, de + n - 1);
    if (error) throw erroSb(`Erro ao ler ${tabela}`, error, status);
    tudo.push(...(data || []));
    if (!data || data.length < n) break;
    de += n;
  }
  return tudo;
}

/* ============================================================
   ESCRITA
   ============================================================ */

async function sbUpsert(tabela, registros, conflito) {
  const lista = Array.isArray(registros) ? registros : [registros];
  for (let i = 0; i < lista.length; i += 500) {
    const { error, status } = await supa.from(tabela).upsert(lista.slice(i, i + 500), { onConflict: conflito || 'id' });
    if (error) throw erroSb(`Erro ao salvar em ${tabela}`, error, status);
  }
}

// Só insere o que ainda não existe (ignora ids repetidos). Usado na auditoria, que é só de inclusão.
async function sbInserirNovos(tabela, registros) {
  const lista = Array.isArray(registros) ? registros : [registros];
  for (let i = 0; i < lista.length; i += 500) {
    const { error, status } = await supa.from(tabela).upsert(lista.slice(i, i + 500), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw erroSb(`Erro ao salvar em ${tabela}`, error, status);
  }
}

async function sbDeletar(tabela, id) {
  const { error, status } = await supa.from(tabela).delete().eq('id', id);
  if (error) throw erroSb(`Erro ao excluir de ${tabela}`, error, status);
}

// Exclui vários ids e devolve os que de fato foram removidos. Com RLS, uma exclusão negada não dá erro:
// simplesmente não remove nada — por isso o retorno importa.
async function sbDeletarVarios(tabela, ids) {
  const removidos = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error, status } = await supa.from(tabela).delete().in('id', ids.slice(i, i + 100)).select('id');
    if (error) throw erroSb(`Erro ao excluir de ${tabela}`, error, status);
    (data || []).forEach(r => removidos.push(r.id));
  }
  return removidos;
}

// Dos ids informados, devolve os que ainda existem na tabela.
async function sbExistentes(tabela, ids) {
  const achados = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error, status } = await supa.from(tabela).select('id').in('id', ids.slice(i, i + 100));
    if (error) throw erroSb(`Erro ao ler ${tabela}`, error, status);
    (data || []).forEach(r => achados.push(r.id));
  }
  return achados;
}

async function sbDeletarPor(tabela, coluna, valor) {
  const { error, status } = await supa.from(tabela).delete().eq(coluna, valor);
  if (error) throw erroSb(`Erro ao excluir de ${tabela}`, error, status);
}

/* ============================================================
   CONFIGURAÇÕES (linha única)
   ============================================================ */

async function sbLerConfig() {
  const { data, error } = await supa.from('configuracoes').select('*').eq('id', 1).single();
  if (error) throw new Error('Erro ao ler configurações: ' + error.message);
  return data;
}

async function sbSalvarConfig(cfg) {
  const { error } = await supa.from('configuracoes').update(cfg).eq('id', 1);
  if (error) throw new Error('Erro ao salvar configurações: ' + error.message);
}

/* ============================================================
   CONVERSÃO DE NOMES
   ============================================================ */

function sbParaApp(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sbParaApp);
  const out = {};
  for (const k in obj) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[ck] = obj[k];
  }
  return out;
}

function appParaSb(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(appParaSb);
  const out = {};
  for (const k in obj) {
    const sk = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    out[sk] = obj[k];
  }
  return out;
}

/* ============================================================
   EXPORTAÇÃO GLOBAL
   ============================================================ */

window.sb = {
  supa,
  usuarioAtual: sbUsuarioAtual,
  perfilAtual: sbPerfilAtual,
  login: sbLogin,
  logout: sbLogout,
  ler: sbLer,
  upsert: sbUpsert,
  inserirNovos: sbInserirNovos,
  deletar: sbDeletar,
  deletarVarios: sbDeletarVarios,
  existentes: sbExistentes,
  deletarPor: sbDeletarPor,
  lerConfig: sbLerConfig,
  salvarConfig: sbSalvarConfig,
  paraApp: sbParaApp,
  paraSb: appParaSb
};

console.log('[SEGESP-GM] supabase.js carregado');
window.dispatchEvent(new Event('sb-pronto'));
