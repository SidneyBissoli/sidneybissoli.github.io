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
#      e as URLs antigas em 301, e o sitemap apontando para o dominio proprio.
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
            $out = @{ code = [int]$resp.StatusCode; location = [string]$resp.Headers['Location'] }
            $resp.Close()
            return $out
        } catch {
            return @{ code = -1; location = $_.Exception.Message }
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

    $s = Status ($dominio + '/nao-existe-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    if ($s.code -ne 404) { $falhas += ("pagina inexistente -> " + $s.code + " (esperado 404)") }

    $sitemap = (Invoke-WebRequest -Uri ($dominio + '/sitemap.xml') -UseBasicParsing -TimeoutSec 30).Content
    if ($sitemap -match 'github\.io') { $falhas += "sitemap ainda cita github.io -- site-url errado no _quarto.yml" }
    if ($sitemap -notmatch 'sidneybissoli\.com/en/blog/posts/') { $falhas += "sitemap sem os posts em ingles" }

    if ($falhas.Count -gt 0) {
        foreach ($f in $falhas) { Registrar ("FALHA: " + $f) }
        throw "conferencia ao vivo falhou (" + $falhas.Count + ")"
    }
    Registrar ("verificado ao vivo: " + $devem200.Count + " paginas em 200, " + $devem301.Count + " redirecionamentos em 301, 404 ok, sitemap no dominio proprio")
}
catch {
    Registrar ("ERRO: " + $_.Exception.Message)
    exit 1
}
finally {
    Pop-Location
}
