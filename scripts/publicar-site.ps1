# Publica o site em https://sidneybissoli.com (Worker com assets, Cloudflare).
#
# ASCII puro de proposito: o powershell.exe 5.1 le .ps1 como ANSI, e um
# travessao ou acento em UTF-8 vira lixo que quebra o parser.
#
# O que faz, na ordem, e para em qualquer falha:
#   1. render dos dois idiomas por scripts/render-site.R (NUNCA `quarto
#      render` direto -- ver o cabecalho daquele script);
#   2. `wrangler deploy` do _site/ conforme wrangler.jsonc;
#   3. conferencia AO VIVO: paginas-chave em 200 nos dois idiomas, o www
#      e as URLs antigas em 301, o llms.txt e os .md dos posts em text/* com
#      charset e canonical, Content-Language por pasta, hreflang e sitemap
#      na forma canonica (200, nao 307) e no dominio proprio.
#      Conferir depois de publicar, nunca confiar no log do deploy.
#
# Uso:  powershell -File scripts/publicar-site.ps1

$ErrorActionPreference = 'Stop'

$raiz    = Split-Path -Parent $PSScriptRoot
$rscript = 'C:\Program Files\R\R-4.6.1\bin\Rscript.exe'
$dominio = 'https://sidneybissoli.com'

function Registrar($texto) { Write-Output ("[publicar-site] " + $texto) }

Push-Location $raiz
try {
    # --- 1. render ----------------------------------------------------------
    Registrar "render..."
    & $rscript 'scripts\render-site.R'
    if ($LASTEXITCODE -ne 0) { throw "render-site.R saiu com $LASTEXITCODE" }
    if (-not (Test-Path '_site\index.html'))      { throw "_site\index.html nao existe" }
    if (-not (Test-Path '_site\en\index.html'))   { throw "_site\en\index.html nao existe" }
    if (-not (Test-Path '_site\_redirects'))      { throw "_site\_redirects nao existe" }
    if (-not (Test-Path '_site\llms.txt'))        { throw "_site\llms.txt nao existe" }
    if (-not (Test-Path '_site\llms-full.txt'))   { throw "_site\llms-full.txt nao existe" }
    if (-not (Test-Path '_site\_headers'))       { throw "_site\_headers nao existe" }

    # --- 2. deploy ----------------------------------------------------------
    # `npx.cmd` e nao `npx` (no PowerShell `npx` resolve para um shim .ps1 que
    # mastiga os argumentos); `--yes` para contexto nao-interativo; versao
    # FIXADA para que uma release nova do wrangler nao mude o deploy sozinha.
    Registrar "deploy..."
    $saida = & npx.cmd --yes wrangler@4.128.0 deploy 2>&1 | Out-String
    Write-Output $saida
    if ($LASTEXITCODE -ne 0) { throw "wrangler deploy saiu com $LASTEXITCODE" }
    if ($saida -notmatch 'sidneybissoli\.com') { throw "o deploy nao listou o dominio proprio -- conferir wrangler.jsonc" }

    # --- 3. conferir na ponta -----------------------------------------------
    # Um deploy novo pode levar alguns segundos para chegar em todos os isolates.
    Start-Sleep -Seconds 5

    # HttpWebRequest direto, e nao Invoke-WebRequest: o powershell.exe 5.1
    # nao tem -SkipHttpErrorCheck e trata 301/404 como excecao (medido no
    # primeiro deploy, 02/09/2026). Aqui 3xx/4xx sao respostas como as outras.
    function Status($url) {
        try {
            $req = [System.Net.HttpWebRequest]::Create($url)
            $req.AllowAutoRedirect = $false
            $req.Timeout = 30000
            $req.UserAgent = 'publicar-site.ps1'
            try { $resp = $req.GetResponse() }
            catch [System.Net.WebException] {
                if ($null -eq $_.Exception.Response) { throw }
                $resp = $_.Exception.Response
            }
            $out = @{ code = [int]$resp.StatusCode; location = [string]$resp.Headers['Location']; ctype = [string]$resp.ContentType; hdr = @{} }
            foreach ($k in $resp.Headers.AllKeys) { $out.hdr[$k] = [string]$resp.Headers[$k] }
            $resp.Close()
            return $out
        } catch {
            return @{ code = -1; location = $_.Exception.Message; ctype = ''; hdr = @{} }
        }
    }

    $falhas = @()

    $devem200 = @('/', '/en/', '/blog/', '/en/blog/', '/tools/', '/en/tools/',
                  '/blog/posts/sidra-tabela-certa/', '/en/blog/posts/sidra-tabela-certa/',
                  '/blog/posts/series-banco-central/', '/blog/posts/cid10-cid11-sus/',
                  '/sitemap.xml', '/robots.txt')
    foreach ($p in $devem200) {
        $s = Status ($dominio + $p)
        if ($s.code -ne 200) { $falhas += ("$p -> " + $s.code + " (esperado 200)") }
    }

    $devem301 = @{
        'https://www.sidneybissoli.com/'          = 'https://sidneybissoli.com/'
        ($dominio + '/publications/')             = '/research/'
        ($dominio + '/index.en.html')             = '/en/index.html'
        ($dominio + '/about.en.html')             = '/en/about.html'
    }
    foreach ($url in $devem301.Keys) {
        $s = Status $url
        $ok = ($s.code -eq 301) -and ($s.location -like ('*' + $devem301[$url]))
        if (-not $ok) { $falhas += ("$url -> " + $s.code + " " + $s.location + " (esperado 301 para " + $devem301[$url] + ")") }
    }

    # Superficie para agentes (render-site.R, passo 4): o llms.txt na raiz e
    # o .md ao lado de cada post. As URLs dos .md sao DERIVADAS dos posts ja
    # conferidos acima, nao pinadas; o Content-Type e conferido na ponta porque
    # o Worker com assets o deduz da extensao (text/markdown esperado -- se
    # vier outro, e caso para o _headers).
    foreach ($p in @('/llms.txt', '/llms-full.txt')) {
        $s = Status ($dominio + $p)
        if ($s.code -ne 200)                             { $falhas += ("$p -> " + $s.code + " (esperado 200)") }
        elseif ($s.ctype -notlike 'text/*charset=utf-8*') { $falhas += ("$p -> Content-Type '" + $s.ctype + "' (esperado text/* com charset=utf-8)") }
    }
    $posts = $devem200 | Where-Object { $_ -like '*/blog/posts/*/' }
    if ($posts.Count -eq 0) { throw "nenhum post na lista devem200 para derivar o .md" }
    foreach ($p in $posts) {
        $md = $p + 'index.md'
        $s = Status ($dominio + $md)
        if ($s.code -ne 200) { $falhas += ("$md -> " + $s.code + " (esperado 200)"); continue }
        if ($s.ctype -notlike 'text/markdown*charset=utf-8*') { $falhas += ("$md -> Content-Type '" + $s.ctype + "' (esperado text/markdown; charset=utf-8)") }
        # o canonical do .md (_headers) tem de apontar para uma URL que responde 200, nao 307
        $link = [string]$s.hdr['Link']
        if ($link -notmatch '<([^>]+)>; rel="canonical"') { $falhas += ("$md -> sem Link canonical (" + $link + ")"); continue }
        $can = Status $Matches[1]
        if ($can.code -ne 200) { $falhas += ("$md -> canonical " + $Matches[1] + " responde " + $can.code + " (esperado 200)") }
    }

    # Cabecalhos do _headers (render-site.R, passo 6): idioma por pasta -- o
    # /en/* DESTACA o do /* antes de por o seu; se a concatenacao voltar
    # ("pt-BR, en"), o Worker mudou de comportamento -- e a higiene basica.
    $s = Status ($dominio + '/')
    if ($s.hdr['Content-Language'] -ne 'pt-BR')          { $falhas += ("/ -> Content-Language '" + $s.hdr['Content-Language'] + "' (esperado pt-BR)") }
    if ($s.hdr['X-Content-Type-Options'] -ne 'nosniff')  { $falhas += ("/ -> sem X-Content-Type-Options: nosniff") }
    $s = Status ($dominio + '/en/')
    if ($s.hdr['Content-Language'] -ne 'en')             { $falhas += ("/en/ -> Content-Language '" + $s.hdr['Content-Language'] + "' (esperado en, sem concatenar)") }

    # URLs canonicas (render-site.R, passo 5), DERIVADAS da pagina inicial ao
    # vivo: cada hreflang dela e o primeiro .js de site_libs (cache de uma
    # semana) tem de responder 200 -- hreflang em 404 foi o defeito de 02/09.
    $inicio = (Invoke-WebRequest -Uri ($dominio + '/') -UseBasicParsing -TimeoutSec 30).Content
    $alts = [regex]::Matches($inicio, 'hreflang="[a-z]+" href="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
    if ($alts.Count -lt 2) { $falhas += "pagina inicial sem os dois hreflang (pt e en)" }
    foreach ($a in $alts) {
        $s = Status $a
        if ($s.code -ne 200) { $falhas += ("hreflang $a -> " + $s.code + " (esperado 200)") }
    }
    if ($inicio -match 'src="(site_libs/[^"]+\.js)"') {
        $s = Status ($dominio + '/' + $Matches[1])
        if ($s.hdr['Cache-Control'] -notlike '*max-age=604800*') { $falhas += ($Matches[1] + " -> Cache-Control '" + $s.hdr['Cache-Control'] + "' (esperado max-age=604800)") }
    } else { $falhas += "pagina inicial sem script de site_libs para conferir o cache" }

    $s = Status ($dominio + '/nao-existe-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    if ($s.code -ne 404) { $falhas += ("pagina inexistente -> " + $s.code + " (esperado 404)") }

    $sitemap = (Invoke-WebRequest -Uri ($dominio + '/sitemap.xml') -UseBasicParsing -TimeoutSec 30).Content
    if ($sitemap -match 'github\.io') { $falhas += "sitemap ainda cita github.io -- site-url errado no _quarto.yml" }
    if ($sitemap -notmatch 'sidneybissoli\.com/en/blog/posts/') { $falhas += "sitemap sem os posts em ingles" }
    # forma canonica: nenhuma <loc> em .html (o Worker responderia 307), e as
    # tres primeiras respondem 200
    $locs = [regex]::Matches($sitemap, '<loc>([^<]+)</loc>') | ForEach-Object { $_.Groups[1].Value }
    if (($locs | Where-Object { $_ -like '*.html' }).Count -gt 0) { $falhas += "sitemap com <loc> em .html (esperado forma canonica)" }
    foreach ($u in ($locs | Select-Object -First 3)) {
        $s = Status $u
        if ($s.code -ne 200) { $falhas += ("sitemap <loc> $u -> " + $s.code + " (esperado 200)") }
    }

    if ($falhas.Count -gt 0) {
        foreach ($f in $falhas) { Registrar ("FALHA: " + $f) }
        throw "conferencia ao vivo falhou (" + $falhas.Count + ")"
    }
    Registrar ("verificado ao vivo: " + $devem200.Count + " paginas em 200, " + $devem301.Count + " redirecionamentos em 301, llms.txt e " + $posts.Count + " .md em text/markdown com charset e canonical em 200, Content-Language por pasta, " + $alts.Count + " hreflang em 200, cache de site_libs, 404 ok, sitemap canonico no dominio proprio")
}
catch {
    Registrar ("ERRO: " + $_.Exception.Message)
    exit 1
}
finally {
    Pop-Location
}
