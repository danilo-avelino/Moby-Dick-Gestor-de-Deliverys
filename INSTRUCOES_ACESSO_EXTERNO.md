# 🌐 Instruções para Acesso Externo

## 📍 Seus IPs

- **IP Local:** `192.168.15.74`
- **IP Público (IPv6):** `2804:1b2:aa40:6019:6173:7336:9bd2:5899`
- **Gateway do Roteador:** `192.168.15.1`

## ⚡ Passo a Passo COMPLETO

### Passo 1: Configurar o Firewall do Windows

**Execute o PowerShell como ADMINISTRADOR** e rode o script:

```powershell
cd "d:\Moby Dick Project"
.\SETUP_ACESSO.ps1
```

Ou execute manualmente:

```powershell
# Liberar porta 5173 (Frontend)
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow

# Liberar porta 3001 (API)
New-NetFirewallRule -DisplayName "Fastify API" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### Passo 2: Atualizar o arquivo .env

Edite o arquivo `.env` na raiz do projeto e altere a linha do CORS:

**Antes:**
```env
CORS_ORIGIN="http://localhost:5173"
```

**Depois:**
```env
CORS_ORIGIN="*"
```

> [!TIP]
> Usar `CORS_ORIGIN="*"` permite que qualquer origem acesse sua API. Para mais segurança em produção, especifique apenas os IPs que devem ter acesso.

### Passo 3: Configurar Port Forwarding no Roteador

1. **Acesse o painel do seu roteador:**
   - Abra o navegador e acesse: `http://192.168.15.1`
   - Faça login (geralmente `admin/admin` ou veja a etiqueta do roteador)

2. **Encontre a seção de Port Forwarding:**
   - Procure por: "Port Forwarding", "Virtual Server", "Redirecionamento de Portas" ou "NAT"

3. **Adicione as seguintes regras:**

**Regra 1 - Frontend (Vite):**
```
Nome: Vite Dev Server
Porta Externa: 5173
Porta Interna: 5173
IP Interno: 192.168.15.74
Protocolo: TCP
```

**Regra 2 - API (Fastify):**
```
Nome: Fastify API
Porta Externa: 3001
Porta Interna: 3001
IP Interno: 192.168.15.74
Protocolo: TCP
```

4. **Salve as configurações** e reinicie o roteador se necessário

### Passo 4: Obter seu IP Público (IPv4)

O comando anterior retornou um IPv6. Para obter o IPv4, execute:

```powershell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

Ou acesse no navegador: https://meuip.com.br

### Passo 5: Reiniciar a Aplicação

Se a aplicação já estiver rodando, pare e reinicie:

```powershell
# Pare a aplicação (Ctrl+C)
# Depois reinicie:
pnpm dev
```

### Passo 6: Testar o Acesso

**Na sua rede local:**
- Frontend: `http://192.168.15.74:5173`
- API: `http://192.168.15.74:3001`

**De fora da sua rede (após configurar port forwarding):**
- Frontend: `http://SEU_IP_PUBLICO_IPV4:5173`
- API: `http://SEU_IP_PUBLICO_IPV4:3001`

## 🔍 Verificação Rápida

Execute este comando para verificar se as portas estão abertas no firewall:

```powershell
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Vite*" -or $_.DisplayName -like "*Fastify*"} | Select-Object DisplayName, Enabled, Direction
```

Deve mostrar:
```
DisplayName         Enabled Direction
-----------         ------- ---------
Vite Dev Server     True    Inbound
Fastify API         True    Inbound
```

## ⚠️ Problemas Comuns

### Problema 1: Não consigo acessar de fora da rede

**Solução:**
1. Confirme que o port forwarding está configurado corretamente
2. Alguns provedores usam CGNAT (seu IP é compartilhado) - neste caso, use um túnel como ngrok
3. Teste se seu provedor permite port forwarding acessando: https://www.canyouseeme.org/

### Problema 2: Página carrega mas API não responde

**Solução:**
1. Verifique se mudou o `CORS_ORIGIN` no `.env`
2. Confirme que a porta 3001 está liberada no firewall
3. Reinicie a aplicação após mudar o `.env`

### Problema 3: Firewall bloqueando

**Solução:**
1. Verifique o Windows Defender
2. Verifique se há antivírus de terceiros bloqueando
3. Temporariamente desative o firewall para testar (não recomendado em produção)

## 🔐 Segurança

> [!WARNING]
> Expor sua aplicação localmente via IP público tem riscos!

**Recomendações:**
1. Use apenas para demonstrações curtas
2. Use senhas fortes na aplicação
3. Após a demonstração, remova o port forwarding
4. Para uso prolongado, considere fazer deploy em nuvem

## 🚀 Alternativa: Túnel Temporário (Mais Fácil)

Se o port forwarding for muito complicado ou não funcionar (CGNAT), use um túnel:

### Opção 1: ngrok
```bash
# Baixe em: https://ngrok.com/download
ngrok http 5173
```

### Opção 2: Cloudflare Tunnel
```bash
# Baixe em: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
cloudflared tunnel --url http://localhost:5173
```

Esses túneis criam uma URL pública temporária automaticamente, sem precisar configurar roteador!

## 📞 Próximos Passos

Depois de configurar tudo:

1. ✅ Execute o script de firewall
2. ✅ Atualize o `.env` (CORS_ORIGIN)
3. ✅ Configure port forwarding no roteador
4. ✅ Obtenha seu IP público IPv4
5. ✅ Reinicie a aplicação
6. ✅ Compartilhe a URL: `http://SEU_IP_PUBLICO:5173`
