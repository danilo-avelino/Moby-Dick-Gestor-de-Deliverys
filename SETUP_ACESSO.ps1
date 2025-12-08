# Script de Configuração de Acesso Externo
# Execute este script como ADMINISTRADOR

Write-Host "🔥 Configurando Firewall do Windows..." -ForegroundColor Cyan

# Verificar se está rodando como administrador
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERRO: Este script precisa ser executado como Administrador!" -ForegroundColor Red
    Write-Host "   Clique com o botão direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    pause
    exit
}

Write-Host ""
Write-Host "Removendo regras antigas (se existirem)..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Vite Dev Server" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Fastify API" -ErrorAction SilentlyContinue

Write-Host "Criando novas regras..." -ForegroundColor Yellow

# Criar regra para o frontend (porta 5173)
New-NetFirewallRule -DisplayName "Vite Dev Server" `
    -Direction Inbound `
    -LocalPort 5173 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any `
    -Description "Permite acesso ao servidor de desenvolvimento Vite"

Write-Host "✅ Porta 5173 (Frontend) liberada" -ForegroundColor Green

# Criar regra para a API (porta 3001)
New-NetFirewallRule -DisplayName "Fastify API" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any `
    -Description "Permite acesso à API Fastify"

Write-Host "✅ Porta 3001 (API) liberada" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Mostrar IPs
Write-Host "📍 Seus endereços IP:" -ForegroundColor Cyan
Write-Host ""

# IP Local
$ipLocal = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress
Write-Host "   IP Local (mesma rede): $ipLocal" -ForegroundColor Yellow
Write-Host "   URL: http://${ipLocal}:5173" -ForegroundColor White
Write-Host ""

# IP Público
Write-Host "   Obtendo IP Público..." -ForegroundColor Yellow
try {
    $ipPublico = (Invoke-WebRequest -Uri "http://ifconfig.me/ip" -TimeoutSec 5).Content.Trim()
    Write-Host "   IP Público (internet): $ipPublico" -ForegroundColor Yellow
    Write-Host "   URL: http://${ipPublico}:5173" -ForegroundColor White
} catch {
    Write-Host "   ⚠️ Não foi possível obter o IP público automaticamente" -ForegroundColor Red
    Write-Host "   Acesse: https://meuip.com.br" -ForegroundColor White
}

Write-Host ""
Write-Host "⚠️  PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Configure Port Forwarding no seu roteador:" -ForegroundColor White
Write-Host "   - Acesse o painel do roteador (geralmente 192.168.1.1)" -ForegroundColor Gray
Write-Host "   - Faça Port Forwarding das portas 5173 e 3001 para o IP Local: $ipLocal" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Atualize o CORS no arquivo .env:" -ForegroundColor White
Write-Host "   CORS_ORIGIN=`"*`"" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Reinicie a aplicação (pnpm dev)" -ForegroundColor White
Write-Host ""
Write-Host "4. Teste o acesso:" -ForegroundColor White
if ($ipPublico) {
    Write-Host "   http://${ipPublico}:5173" -ForegroundColor Green
}
Write-Host ""

pause
