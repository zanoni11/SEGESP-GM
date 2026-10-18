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

async function sbPerfilAtual() {
  const user = await sbUsuarioAtual();
  if (!user) return null;
  const { data, error } = await supa.from('usuarios').select('*').eq('id', user.id).single();
  if (error) { console.warn('Erro ao buscar perfil:', error); return null; }
  return data;
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
   LEITURA
   ============================================================ */

async function sbLer(tabela, ordem) {
  let q = supa.from(tabela).select('*');
  if (ordem) q = q.order(ordem);
  const { data, error } = await q;
  if (error) throw new Error(`Erro ao ler ${tabela}: ${error.message}`);
  return data || [];
}

/* ============================================================
   ESCRITA
   ============================================================ */

async function sbUpsert(tabela, registros, conflito) {
  const lista = Array.isArray(registros) ? registros : [registros];
  if (!lista.length) return;
  const { error } = await supa.from(tabela).upsert(lista, { onConflict: conflito || 'id' });
  if (error) throw new Error(`Erro ao salvar em ${tabela}: ${error.message}`);
}

async function sbDeletar(tabela, id) {
  const { error } = await supa.from(tabela).delete().eq('id', id);
  if (error) throw new Error(`Erro ao excluir de ${tabela}: ${error.message}`);
}

async function sbDeletarPor(tabela, coluna, valor) {
  const { error } = await supa.from(tabela).delete().eq(coluna, valor);
  if (error) throw new Error(`Erro ao excluir de ${tabela}: ${error.message}`);
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
  deletar: sbDeletar,
  deletarPor: sbDeletarPor,
  lerConfig: sbLerConfig,
  salvarConfig: sbSalvarConfig,
  paraApp: sbParaApp,
  paraSb: appParaSb
};

console.log('[SEGESP-GM] supabase.js carregado');
window.dispatchEvent(new Event('sb-pronto'));
