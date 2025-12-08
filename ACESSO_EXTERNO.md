# 🌐 Configuração de Acesso Externo

Este guia mostra como permitir que pessoas fora da sua rede local acessem sua aplicação.

## ✅ Configurações Já Realizadas

- ✅ Backend configurado para aceitar conexões externas (`host: '0.0.0.0'`)
- ✅ Frontend configurado para aceitar conexões externas (`host: '0.0.0.0'`)

## 📋 Passos para Acesso Externo

### 1. Descobrir seu IP Local

Abra o PowerShell e execute:

```powershell
ipconfig
```

Procure por **"Endereço IPv4"** na sua conexão ativa (Wi-Fi ou Ethernet).
Exemplo: `192.168.1.100`

### 2. Descobrir seu IP Público

Acesse um destes sites ou execute o comando:

```powershell
# Pelo PowerShell
(Invoke-WebRequest -Uri "http://ifconfig.me/ip").Content
```

Ou acesse: https://meuip.com.br

### 3. Liberar as Portas no Firewall do Windows

Execute o PowerShell **como Administrador** e rode:

```powershell
# Liberar porta 5173 (Frontend)
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow

# Liberar porta 3001 (API)
New-NetFirewallRule -DisplayName "Fastify API" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### 4. Configurar Port Forwarding no Roteador

Esta etapa varia de acordo com seu roteador. Geralmente:

1. Acesse o painel do roteador (geralmente `192.168.1.1` ou `192.168.0.1`)
2. Entre com usuário/senha (geralmente `admin/admin`)
3. Procure por "Port Forwarding", "Virtual Server" ou "Redirecionamento de Portas"
4. Adicione duas regras:

**Regra 1 - Frontend:**
- Porta Externa: `5173`
- Porta Interna: `5173`
- IP Interno: `192.168.1.100` (seu IP local)
- Protocolo: `TCP`

**Regra 2 - API:**
- Porta Externa: `3001`
- Porta Interna: `3001`
- IP Interno: `192.168.1.100` (seu IP local)
- Protocolo: `TCP`

### 5. Atualizar CORS na API

Edite o arquivo `.env` na raiz do projeto e adicione seu IP público:

```env
# Permitir acesso do seu IP público
CORS_ORIGIN="http://SEU_IP_PUBLICO:5173"

# Ou permitir qualquer origem (menos seguro, apenas para testes)
CORS_ORIGIN="*"
```

### 6. Testar a Aplicação

**Na sua rede local:**
- Frontend: `http://192.168.1.100:5173`
- API: `http://192.168.1.100:3001`

**De fora da sua rede:**
- Frontend: `http://SEU_IP_PUBLICO:5173`
- API: `http://SEU_IP_PUBLICO:3001`

## ⚠️ Considerações de Segurança

> [!WARNING]
> Expor seu IP público tem riscos de segurança!

1. **Use apenas para testes curtos** - Não deixe as portas abertas permanentemente
2. **Mantenha boas credenciais** - Use senhas fortes na aplicação
3. **Considere um túnel** - Para uso prolongado, use ngrok ou Cloudflare Tunnel
4. **IP Dinâmico** - A maioria dos provedores muda seu IP público periodicamente

## 🔄 IP Dinâmico vs IP Fixo

Seu provedor de internet provavelmente fornece um **IP dinâmico** que muda periodicamente.

**Soluções:**

1. **Serviço DDNS (Dynamic DNS):**
   - No-IP (gratuito): https://www.noip.com
   - DuckDNS (gratuito): https://www.duckdns.org
   - Cria um domínio como `seuapp.ddns.net` que sempre aponta para seu IP atual

2. **Contratar IP Fixo:**
   - Entre em contato com seu provedor de internet
   - Geralmente tem custo adicional mensal

## 🚀 Alternativas Recomendadas

Para demonstrações mais profissionais:

1. **ngrok** - Túnel temporário com HTTPS
2. **Cloudflare Tunnel** - Túnel gratuito e estável
3. **Deploy na Nuvem** - Vercel (frontend) + Railway (backend)

## 📝 Comandos Úteis

```powershell
# Ver regras do firewall
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Vite*" -or $_.DisplayName -like "*Fastify*"}

# Remover regras do firewall
Remove-NetFirewallRule -DisplayName "Vite Dev Server"
Remove-NetFirewallRule -DisplayName "Fastify API"

# Descobrir seu IP público
(Invoke-WebRequest -Uri "http://ifconfig.me/ip").Content
```

## 🆘 Troubleshooting

**Problema:** Não consigo acessar de fora da rede

**Soluções:**
1. Verifique se o firewall está liberado
2. Confirme o port forwarding no roteador
3. Teste com `http://` e não `https://`
4. Confirme que as aplicações estão rodando
5. Alguns provedores bloqueiam port forwarding (CGNAT) - neste caso, use túneis

**Problema:** Página carrega mas API não funciona

**Soluções:**
1. Verifique o CORS_ORIGIN no `.env`
2. Confirme que a porta 3001 está aberta no firewall
3. Atualize o `VITE_API_URL` no `.env` do frontend para o IP público
