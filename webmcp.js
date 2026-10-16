// WebMCP: ferramentas que um agente RODANDO NO NAVEGADOR do visitante (com
// esta página aberta) pode chamar. Vitrine, não canal: Claude, ChatGPT pela
// API e buscadores nunca veem isto — para eles existem os servidores MCP
// hospedados, o /llms.txt e o .md ao lado de cada página.
//
// API medida em 16/10/2026 (spec do W3C WebML CG + Chrome 155):
// - só `document.modelContext` (o `navigator.modelContext` foi removido);
// - `registerTool(tool, {signal})`, desregistro abortando o sinal;
// - `execute(args)` recebe OBJETO e devolve string;
// - a forma declarativa (`<form toolname>`) saiu da spec em 08/10/2026.
// Sem a API (navegador comum), este arquivo não faz nada.
//
// Tudo é somente leitura e lê só arquivos que o próprio site já publica
// (search.json, index.xml, os .md): nada aqui é lista copiada à mão.
(function () {
  "use strict";
  if (!("modelContext" in document) || !window.isSecureContext) return;

  var EN = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0;
  var BASE = EN ? "/en/" : "/";
  var ORIGEM = location.origin;
  var t = function (pt, en) { return EN ? en : pt; };

  // Endereço do servidor do Banco Central, o único aberto a esta origem
  // (decisão de 16/10/2026: os outros seis só se houver uso medido).
  var BCB_MCP = "https://bcb.sidneybissoli.com/mcp";

  function texto(obj) {
    return typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  async function buscar(caminho, signal) {
    var r = await fetch(caminho, { signal: signal, headers: { Accept: "*/*" } });
    if (!r.ok) throw new Error(caminho + ": HTTP " + r.status);
    return r;
  }

  // Comparação sem acento e sem caixa: "populacao" acha "população".
  function normaliza(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // ---- buscar_no_site ------------------------------------------------------
  var indice = null;
  async function carregaIndice(signal) {
    // Guarda só o índice que chegou inteiro: uma falha não fica em cache.
    if (!indice) indice = await (await buscar(BASE + "search.json", signal)).json();
    return indice;
  }

  async function buscarNoSite(args, ctx) {
    var termos = normaliza(args && args.consulta).split(/\s+/).filter(Boolean);
    if (termos.length === 0) throw new Error(t("consulta vazia", "empty query"));
    var limite = Math.min(Math.max(Number(args.limite) || 8, 1), 25);
    var registros = await carregaIndice(ctx && ctx.signal);
    var achados = [];
    registros.forEach(function (r) {
      var titulo = normaliza(r.title + " " + r.section);
      var corpo = normaliza(r.text);
      var nota = 0;
      for (var i = 0; i < termos.length; i++) {
        var noTitulo = titulo.indexOf(termos[i]) >= 0;
        var noCorpo = corpo.indexOf(termos[i]) >= 0;
        if (!noTitulo && !noCorpo) return; // todos os termos precisam aparecer
        nota += noTitulo ? 3 : 1;
      }
      var pos = corpo.indexOf(termos[0]);
      var ini = Math.max(0, pos - 80);
      achados.push({
        nota: nota,
        titulo: r.section ? r.title + " — " + r.section : r.title,
        url: new URL(BASE + r.href, ORIGEM).href,
        trecho: (ini > 0 ? "…" : "") + String(r.text).slice(ini, ini + 240).replace(/\s+/g, " ") + "…"
      });
    });
    achados.sort(function (a, b) { return b.nota - a.nota; });
    return texto({
      consulta: args.consulta,
      total: achados.length,
      resultados: achados.slice(0, limite).map(function (a) {
        return { titulo: a.titulo, url: a.url, trecho: a.trecho };
      })
    });
  }

  // ---- ler_pagina -------------------------------------------------------------
  // Resolve um endereço DESTE site para o .md publicado ao lado do HTML.
  function caminhoDoMd(endereco) {
    var u = new URL(String(endereco || BASE), location.href);
    if (u.origin !== ORIGEM) {
      throw new Error(t("só lê páginas de ", "only reads pages from ") + ORIGEM);
    }
    var p = u.pathname;
    if (/\.md$/.test(p)) return p;
    if (/\.html$/.test(p)) return p.replace(/\.html$/, ".md");
    if (/\/$/.test(p)) return p + "index.md";
    if (!/\.[a-z0-9]+$/i.test(p)) return p + "/index.md";
    throw new Error(t("não é uma página: ", "not a page: ") + p);
  }

  async function lerPagina(args, ctx) {
    var md = caminhoDoMd(args && args.endereco);
    var r = await fetch(md, { signal: ctx && ctx.signal });
    if (r.status === 404) {
      throw new Error(t(
        md + " não tem versão em Markdown. Índice do que tem: " + ORIGEM + "/llms.txt",
        md + " has no Markdown version. Index of what does: " + ORIGEM + "/llms.txt"
      ));
    }
    if (!r.ok) throw new Error(md + ": HTTP " + r.status);
    return "<!-- " + new URL(md, ORIGEM).href + " -->\n" + (await r.text());
  }

  // ---- listar_produtos --------------------------------------------------------
  // As próprias páginas de servidores e de pacotes, em Markdown: a fonte é o
  // que o visitante vê, sem uma segunda lista para envelhecer.
  async function listarProdutos(args, ctx) {
    var tipo = (args && args.tipo) || "todos";
    var paginas = [];
    if (tipo !== "pacotes_r") paginas.push(BASE + "tools/index.md");
    if (tipo !== "servidores_mcp") paginas.push(BASE + "packages/index.md");
    var partes = await Promise.all(paginas.map(function (p) {
      return lerPagina({ endereco: p }, ctx);
    }));
    return partes.join("\n\n---\n\n");
  }

  // ---- posts_recentes ---------------------------------------------------------
  async function postsRecentes(args, ctx) {
    var xml = await (await buscar(BASE + "blog/index.xml", ctx && ctx.signal)).text();
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    var limite = Math.min(Math.max(Number(args && args.limite) || 5, 1), 20);
    var itens = Array.prototype.slice.call(doc.querySelectorAll("item"), 0, limite);
    var campo = function (el, nome) {
      var c = el.querySelector(nome);
      return c ? c.textContent.trim() : null;
    };
    return texto(itens.map(function (it) {
      // O resumo do feed é HTML: DOMParser é inerte (não roda script nem
      // carrega imagem), ao contrário de innerHTML num elemento solto.
      var resumo = new DOMParser().parseFromString(campo(it, "description") || "", "text/html").body;
      return {
        titulo: campo(it, "title"),
        url: campo(it, "link"),
        data: campo(it, "pubDate"),
        resumo: resumo.textContent.replace(/\s+/g, " ").trim().slice(0, 300)
      };
    }));
  }

  // ---- Banco Central (servidor MCP hospedado, por JSON-RPC direto) ---------
  // O servidor é sem estado: um `tools/call` avulso basta. A resposta pode vir
  // como JSON ou como SSE (`data: {...}`), conforme o servidor escolher.
  async function chamaBcb(nome, argumentos, signal) {
    var r = await fetch(BCB_MCP, {
      method: "POST",
      signal: signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: nome, arguments: argumentos }
      })
    });
    if (!r.ok) throw new Error("bcb.sidneybissoli.com: HTTP " + r.status);
    var bruto = await r.text();
    var msg = null;
    if ((r.headers.get("Content-Type") || "").indexOf("text/event-stream") >= 0) {
      bruto.split(/\r?\n/).forEach(function (l) {
        if (l.indexOf("data:") === 0) {
          var m = JSON.parse(l.slice(5));
          if (m.id === 1) msg = m;
        }
      });
    } else {
      msg = JSON.parse(bruto);
    }
    if (!msg) throw new Error(t("resposta vazia do servidor do BCB", "empty response from the BCB server"));
    if (msg.error) throw new Error(msg.error.message);
    var conteudo = (msg.result && msg.result.content) || [];
    var saida = conteudo.filter(function (c) { return c.type === "text"; })
      .map(function (c) { return c.text; }).join("\n");
    if (msg.result && msg.result.isError) throw new Error(saida);
    return saida;
  }

  // ---- registro ----------------------------------------------------------------
  var LEITURA = { readOnlyHint: true };
  var ferramentas = [
    {
      name: "buscar_no_site",
      title: t("Buscar no site", "Search the site"),
      description: t(
        "Busca nas páginas e posts de sidneybissoli.com (servidores MCP, pacotes R, textos, publicações). Sem acento e sem caixa; todos os termos precisam aparecer. Devolve título, URL e trecho.",
        "Searches the pages and posts of sidneybissoli.com (MCP servers, R packages, writing, publications). Accent- and case-insensitive; every term must appear. Returns title, URL and excerpt."
      ),
      inputSchema: {
        type: "object",
        properties: {
          consulta: { type: "string", description: t("termos de busca", "search terms") },
          limite: { type: "integer", minimum: 1, maximum: 25, default: 8 }
        },
        required: ["consulta"]
      },
      execute: buscarNoSite
    },
    {
      name: "listar_produtos",
      title: t("Listar servidores MCP e pacotes R", "List MCP servers and R packages"),
      description: t(
        "Devolve, em Markdown, as páginas que descrevem os servidores MCP (endereços para conectar um assistente) e os pacotes R do autor, com links para GitHub, npm e CRAN.",
        "Returns, as Markdown, the pages describing the author's MCP servers (addresses to connect an assistant to) and R packages, with links to GitHub, npm and CRAN."
      ),
      inputSchema: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["todos", "servidores_mcp", "pacotes_r"], default: "todos" }
        }
      },
      execute: listarProdutos
    },
    {
      name: "ler_pagina",
      title: t("Ler uma página do site", "Read a site page"),
      description: t(
        "Lê o texto de uma página deste site em Markdown (sem menus nem layout). Aceita URL ou caminho, como /about.html ou /blog/posts/sidra-via-mcp/. Sem endereço, lê a página atual.",
        "Reads a page of this site as Markdown (no menus or layout). Takes a URL or path such as /en/about.html or /en/blog/posts/sidra-via-mcp/. Without an address, reads the current page."
      ),
      inputSchema: {
        type: "object",
        properties: { endereco: { type: "string", description: t("URL ou caminho neste site", "URL or path on this site") } }
      },
      execute: function (args, ctx) {
        return lerPagina({ endereco: (args && args.endereco) || location.pathname }, ctx);
      }
    },
    {
      name: "posts_recentes",
      title: t("Posts recentes", "Recent posts"),
      description: t(
        "Lista os textos mais recentes do blog (título, URL, data e resumo), a partir do feed RSS.",
        "Lists the most recent blog posts (title, URL, date and summary), from the RSS feed."
      ),
      inputSchema: {
        type: "object",
        properties: { limite: { type: "integer", minimum: 1, maximum: 20, default: 5 } }
      },
      execute: postsRecentes
    },
    {
      name: "bcb_indicadores_atuais",
      title: t("Banco Central: indicadores atuais", "Central Bank of Brazil: current indicators"),
      description: t(
        "Valores mais recentes dos principais indicadores do Banco Central do Brasil (Selic, IPCA, câmbio e outros), consultados ao vivo no servidor MCP bcb.sidneybissoli.com, com fonte e instante da extração.",
        "Latest values of the main Central Bank of Brazil indicators (Selic, IPCA inflation, exchange rate and others), fetched live from the bcb.sidneybissoli.com MCP server, with source and extraction time."
      ),
      inputSchema: { type: "object", properties: {} },
      execute: function (args, ctx) {
        return chamaBcb("bcb_indicadores_atuais", {}, ctx && ctx.signal);
      }
    }
  ];

  var controle = new AbortController();
  ferramentas.forEach(function (f) {
    f.annotations = LEITURA;
    Promise.resolve()
      .then(function () { return document.modelContext.registerTool(f, { signal: controle.signal }); })
      .catch(function (e) { console.warn("[webmcp] " + f.name + ":", e); });
  });
  // Sem abortar no `pagehide`: a navegação descarta o documento sozinha, e
  // abortar deixaria a página sem ferramentas ao voltar pelo cache (bfcache).
})();
