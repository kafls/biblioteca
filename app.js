// =====================================================
// CONFIGURAÇÃO DO SUPABASE
// =====================================================
// URL do projeto Supabase
const SUPABASE_URL = "https://ioywlpruhjuifyizulrh.supabase.co/";

// Chave pública do projeto
const SUPABASE_ANON_KEY = "sb_publishable_6z6bxY6RW6F83gTJ3JncAQ_yAfzHgGO";

// Cria a conexão com o Supabase
const supabaseClient = supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
);
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function aviso(texto, tipo = "ok") {
  const m = $("mensagem");
  m.textContent = texto;
  m.className = tipo;
}

// Executa uma chamada ao Supabase e trata erro
async function executar(promessa, sucesso) {
  const { data, error } = await promessa;
  if (error) { aviso("Erro: " + error.message, "erro"); return null; }
  if (sucesso) aviso(sucesso);
  return data ?? true;
}

// ---------- Abas ----------
document.querySelectorAll(".aba").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach((x) => x.classList.toggle("ativa", x === b));
    document.querySelectorAll(".painel").forEach((p) => (p.hidden = p.id !== b.dataset.aba));
  })
);

// ---------- LIVROS ----------
async function listarLivros() {
  const { data, error } = await db.from("livros").select("*").order("titulo");
  if (error) return aviso("Erro: " + error.message, "erro");
  $("lista-livros").innerHTML = data.length
    ? data.map((l) => `<tr>
        <td>${esc(l.titulo)}</td><td>${esc(l.autor)}</td><td>${esc(l.ano)}</td>
        <td class="${l.disponivel ? "disp" : "indisp"}">${l.disponivel ? "Disponível" : "Emprestado"}</td>
        <td><button class="acao perigo" onclick="excluirLivro(${l.id})">Excluir</button></td></tr>`).join("")
    : `<tr><td colspan="5" class="vazio">Nenhum livro cadastrado.</td></tr>`;
  $("emp-livro").innerHTML = `<option value="">Livro…</option>` +
    data.filter((l) => l.disponivel).map((l) => `<option value="${l.id}">${esc(l.titulo)}</option>`).join("");
}

$("form-livro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ano = $("livro-ano").value;
  const ok = await executar(
    db.from("livros").insert({ titulo: $("livro-titulo").value.trim(), autor: $("livro-autor").value.trim(), ano: ano ? Number(ano) : null }),
    "Livro cadastrado."
  );
  if (ok) { e.target.reset(); listarLivros(); }
});

async function excluirLivro(id) {
  if (!confirm("Excluir este livro?")) return;
  const ok = await executar(db.from("livros").delete().eq("id", id), "Livro excluído.");
  if (ok) listarLivros();
}

// ---------- USUÁRIOS ----------
async function listarUsuarios() {
  const { data, error } = await db.from("usuarios").select("*").order("nome");
  if (error) return aviso("Erro: " + error.message, "erro");
  $("lista-usuarios").innerHTML = data.length
    ? data.map((u) => `<tr><td>${esc(u.nome)}</td><td>${esc(u.email)}</td>
        <td><button class="acao perigo" onclick="excluirUsuario(${u.id})">Excluir</button></td></tr>`).join("")
    : `<tr><td colspan="3" class="vazio">Nenhum usuário cadastrado.</td></tr>`;
  $("emp-usuario").innerHTML = `<option value="">Usuário…</option>` +
    data.map((u) => `<option value="${u.id}">${esc(u.nome)}</option>`).join("");
}

$("form-usuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ok = await executar(
    db.from("usuarios").insert({ nome: $("usuario-nome").value.trim(), email: $("usuario-email").value.trim() || null }),
    "Usuário cadastrado."
  );
  if (ok) { e.target.reset(); listarUsuarios(); }
});

async function excluirUsuario(id) {
  if (!confirm("Excluir este usuário?")) return;
  const ok = await executar(db.from("usuarios").delete().eq("id", id), "Usuário excluído.");
  if (ok) listarUsuarios();
}

// ---------- EMPRÉSTIMOS ----------
async function listarEmprestimos() {
  const { data, error } = await db
    .from("emprestimos")
    .select("id, livro_id, data_emprestimo, data_devolucao, devolvido, livros(titulo), usuarios(nome)")
    .order("id", { ascending: false });
  if (error) return aviso("Erro: " + error.message, "erro");
  const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
  $("lista-emprestimos").innerHTML = data.length
    ? data.map((m) => `<tr>
        <td>${esc(m.livros?.titulo)}</td><td>${esc(m.usuarios?.nome)}</td>
        <td>${fmt(m.data_emprestimo)}</td><td>${fmt(m.data_devolucao)}</td>
        <td>${m.devolvido ? "Devolvido" : `<button class="acao" onclick="devolver(${m.id}, ${m.livro_id})">Registrar devolução</button>`}</td></tr>`).join("")
    : `<tr><td colspan="5" class="vazio">Nenhum empréstimo registrado.</td></tr>`;
}

$("form-emprestimo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const livroId = Number($("emp-livro").value);
  const usuarioId = Number($("emp-usuario").value);
  if (!livroId || !usuarioId) return aviso("Selecione o livro e o usuário.", "erro");

  // Impede empréstimo de livro indisponível (verifica no banco)
  const { data: livro, error } = await db.from("livros").select("disponivel").eq("id", livroId).single();
  if (error) return aviso("Erro: " + error.message, "erro");
  if (!livro.disponivel) { aviso("Este livro já está emprestado.", "erro"); return carregarTudo(); }

  const ok = await executar(db.from("emprestimos").insert({ livro_id: livroId, usuario_id: usuarioId }));
  if (!ok) return;
  await executar(db.from("livros").update({ disponivel: false }).eq("id", livroId), "Empréstimo registrado.");
  carregarTudo();
});

async function devolver(id, livroId) {
  const hoje = new Date().toISOString().slice(0, 10);
  const ok = await executar(db.from("emprestimos").update({ devolvido: true, data_devolucao: hoje }).eq("id", id));
  if (!ok) return;
  await executar(db.from("livros").update({ disponivel: true }).eq("id", livroId), "Devolução registrada.");
  carregarTudo();
}

// ---------- Início ----------
function carregarTudo() { listarLivros(); listarUsuarios(); listarEmprestimos(); }
carregarTudo();