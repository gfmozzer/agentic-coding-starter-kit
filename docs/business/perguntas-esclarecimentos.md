# Perguntas e Esclarecimentos - Sistema Multi-tenant de Tradução

## 📋 Resumo da Análise

Após análise detalhada do `starter-prompt.md`, identifiquei os requisitos principais para transformar o boilerplate em um sistema multi-tenant de tradução de documentos. O projeto está bem definido, mas algumas especificações técnicas precisam ser esclarecidas antes do desenvolvimento.

---

## ❓ Perguntas Críticas para Esclarecimento

### 1. Integração com n8n

**Pergunta:** Qual é a configuração atual do n8n?

Quanto ao n8n, já está tudo instalado e funcionando.só preciso que chegue até o webhook que eu configurar e um endpoint para cada tipo de agente para eu devolver a respostas, ou um local no proprio banco que eu possa gravar a respostas e me informar o formato esperado da resposta
- Você já tem uma instância do n8n rodando?
- Qual a URL base do n8n que será integrada?
- Como será a autenticação entre o app e o n8n (API key, webhook secret)?
- Existe algum workflow base no n8n que devo usar como referência?

**Impacto:** Essencial para implementar a Fase 5 (Sistema de Jobs)

### 2. Serviço de Storage

**Pergunta:** Qual serviço de storage será usado?
- AWS S3 (preciso das credenciais/bucket)
- MinIO local (preciso da configuração)

Um buket publico que de ser possivel configurar variaveis pelo dasboard do superadmin as url temporarias (criadas para o Job) serao gerenciadas pelo n8n, para validacao temos storage blos no .env, mas para egfeit vou disponibilizar um bucket publico do mini para desenvolvimento:
- STORAGE_BUCKET_NAME=service-doc-temp
    - STORAGE_ACCESS_KEY_ID=J0fRLZqrfgW9VF7tPfyW
    - STORAGE_SECRET_ACCESS_KEY=txaUOkO6n5aFBbW5eI9RkBtoW5xR7Cf3evar1mXC
    - STORAGE_ENDPOINT=https://s3.atendamelhor.com
    - STORAGE_FORCE_PATH_STYLE=true

- Outro serviço de storage?
- Qual a estrutura de pastas desejada?

**Impacto:** Necessário para upload de PDFs e armazenamento de resultados

### 3. Autenticação de Webhooks

**Pergunta:** Como será a segurança dos webhooks?

Não haverá autenticacao no webhook, caso resovermos usar sera um headerauth apenas e podemos configurar no cadastro do webhook
- Usar assinatura HMAC?
- Token fixo no header?
- IP whitelist?
- Qual o método preferido?

**Impacto:** Segurança crítica para callbacks do n8n

### 4. Dados de Exemplo

**Pergunta:** Você tem dados de exemplo para popular o sistema?

tenho os agentes ja escritos 
- Agentes de exemplo (OCR, extratores)
- Workflows de referência
- PDFs de teste
- Templates HTML base

**Impacto:** Facilita desenvolvimento e testes

### 5. Deploy e Ambiente

**Pergunta:** Qual será o ambiente de deploy?

vercel, por ser mais rapida para um mvp, com banco externo.
- Docker local
- Cloud provider (AWS, GCP, Azure)
- VPS próprio
- Precisa de configuração específica?

**Impacto:** Configuração de CI/CD e scripts de deploy

### 6. Monitoramento e Logs

**Pergunta:** Qual ferramenta de monitoramento usar?

Logs simples
- Logs simples em arquivo
- Sentry para erros
- Prometheus + Grafana
- Outro sistema de monitoramento?

**Impacto:** Observabilidade e debugging em produção

---

## ✅ Pontos Bem Definidos (Não Precisam Esclarecimento)

### Arquitetura Geral
- ✅ Sistema multi-tenant com RLS
- ✅ 3 papéis: Super-Admin, Tenant Admin, Operador
- ✅ Workflow Builder visual
- ✅ Review Gates com interface de revisão
- ✅ Clonagem e personalização de workflows/agentes

### Stack Tecnológica
- ✅ Next.js 14 com App Router
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ Drizzle ORM
- ✅ PostgreSQL
- ✅ Shadcn/ui

### Funcionalidades Core
- ✅ 4 tipos de agentes (OCR, extract_structured, extract_unstructured, webhook)
- ✅ Estados de job bem definidos
- ✅ Fluxo de execução detalhado
- ✅ Contratos de API com n8n especificados

---

## 🎯 Sugestões de Implementação

### 1. Ordem de Desenvolvimento Recomendada

Baseado na análise, sugiro manter a ordem das 8 fases do planejamento:

1. **Fase 1-2:** Fundação (Schema + Auth) - Base sólida
2. **Fase 3-4:** Core Features (Agentes + Builder) - Funcionalidades principais
3. **Fase 5-6:** Execução (Jobs + Review) - Fluxo operacional
4. **Fase 7-8:** Finalização (Clone + Testes) - Polimento

### 2. Configurações Padrão Sugeridas

Enquanto aguardamos esclarecimentos, posso usar estas configurações padrão:

```env
# Storage (MinIO local para desenvolvimento)
STORAGE_TYPE=minio
MINIO_ENDPOINT=localhost:9000
MINIO_BUCKET=translator-docs

# n8n (instância local padrão)
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_API_KEY=your-api-key

# Webhook Security
WEBHOOK_SECRET=your-webhook-secret

# Monitoramento (logs simples)
LOG_LEVEL=info
LOG_FORMAT=json
```

### 3. Dados de Exemplo Padrão

Posso criar dados de exemplo básicos:

- **Super-Admin:** super@admin.com
- **Tenant de Teste:** "Empresa Demo"
- **Agentes Base:** OCR simples, Extrator de CPF/CNPJ
- **Workflow Demo:** OCR → Extração → Review Gate
- **PDFs de Teste:** Documentos brasileiros simulados

---

## 🚀 Próximos Passos Sugeridos

### Opção 1: Começar com Configurações Padrão
- Inicio o desenvolvimento usando as configurações sugeridas
- Você ajusta as configurações conforme necessário
- Foco na implementação das funcionalidades core

### Opção 2: Aguardar Esclarecimentos
- Você responde as perguntas críticas
- Eu ajusto o planejamento conforme suas respostas
- Desenvolvimento mais direcionado às suas necessidades

### Opção 3: Desenvolvimento Híbrido
- Inicio com Fase 1-2 (independem de configurações externas)
- Você esclarece as integrações enquanto desenvolvo a base
- Implemento as integrações após os esclarecimentos

---

## 📝 Template de Resposta

Para facilitar, você pode copiar e preencher:

```
### Respostas aos Esclarecimentos

1. **n8n:**
   - URL: _______________
   - Auth: _______________
   - Workflow base: _______________

2. **Storage:**
   - Tipo: _______________
   - Configuração: _______________

3. **Webhook Security:**
   - Método: _______________
   - Secret: _______________

4. **Dados de Exemplo:**
   - [ ] Usar dados padrão
   - [ ] Vou fornecer dados específicos

5. **Deploy:**
   - Ambiente: _______________
   - Configurações especiais: _______________

6. **Monitoramento:**
   - Ferramenta: _______________

### Próximo Passo Preferido:
- [ ] Opção 1: Começar com padrões
- [ ] Opção 2: Aguardar esclarecimentos
- [ ] Opção 3: Desenvolvimento híbrido
```

---

## 🎯 Conclusão

O projeto está muito bem especificado no `starter-prompt.md`. A arquitetura é clara, os requisitos são detalhados e o escopo está bem definido. 

As perguntas acima são principalmente sobre **configurações de ambiente e integrações externas**, não sobre a lógica de negócio que já está bem definida.

Posso começar o desenvolvimento imediatamente com configurações padrão, ou aguardar seus esclarecimentos para uma implementação mais direcionada.

**Recomendação:** Sugiro a Opção 3 (Desenvolvimento Híbrido) para otimizar o tempo - inicio a base enquanto você prepara as configurações de integração.

Qual opção prefere?