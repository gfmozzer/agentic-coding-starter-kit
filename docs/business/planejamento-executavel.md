# Planejamento Executável - Sistema Multi-tenant de Tradução

## Visão Geral do Projeto

Sistema multi-tenant para tradução de documentos com workflows compostos por agentes (OCR, extratores, tradutor), grupos de extratores e review gates (pontos de revisão humana).

## Arquitetura de Desenvolvimento

### Papéis do Sistema
- **Super-Admin**: Gerencia tenants, agentes globais, templates e workflow builder
- **Admin do Tenant**: Clona recursos globais e gerencia usuários do tenant
- **Operador**: Executa workflows, faz uploads e revisa nos review gates

### Tecnologias Base (Preservadas)
- Next.js 15 + TypeScript + App Router
- Better Auth + Google OAuth
- Drizzle ORM + PostgreSQL
- Vercel AI SDK + OpenAI
- shadcn/ui + Tailwind CSS
- MinIO Storage (desenvolvimento) + Vercel Blob (produção)

---

## FASE 1: Fundação e Schema do Banco de Dados

### Tarefas Executáveis

#### 1.1 Schema Base Multi-tenant
**Descrição**: Criar todas as tabelas necessárias com RLS por tenant_id

**Subtarefas**:
- [ ] Criar tabela `tenants` (id, name, settings, created_at)
- [ ] Criar tabela `users` com tenant_id e roles (super_admin, tenant_admin, operator)
- [ ] Criar tabela `agents` (id, tenant_id, name, type, model, prompts, etc.)
- [ ] Criar tabela `templates` (id, tenant_id, name, html_content, variables)
- [ ] Criar tabela `workflows` (id, tenant_id, name, steps_json, is_global)
- [ ] Criar tabela `jobs` (id, tenant_id, workflow_id, status, pdf_url, results)
- [ ] Criar tabela `review_sessions` (id, job_id, gate_id, keys_data, status)
- [ ] Criar tabela `key_audit` (id, session_id, key_name, old_value, new_value, source_agent_id)

**Checklist de Verificação**:
- [ ] Todas as tabelas têm tenant_id (exceto tenants e users globais)
- [ ] RLS policies criadas para cada tabela
- [ ] Índices criados em tenant_id e chaves estrangeiras
- [ ] Constraints de integridade referencial implementadas
- [ ] Migrações Drizzle executam sem erro

**Teste de Aceitação (Playwright)**:
```typescript
// tests/database/schema.spec.ts
test('Schema multi-tenant com RLS', async ({ page }) => {
  // Verificar que usuário de um tenant não acessa dados de outro
  // Testar inserção com tenant_id obrigatório
  // Validar constraints e relacionamentos
});
```

#### 1.2 Configuração RLS (Row-Level Security)
**Descrição**: Implementar políticas de segurança por tenant

**Subtarefas**:
- [ ] Habilitar RLS em todas as tabelas multi-tenant
- [ ] Criar policy SELECT com tenant_id = current_tenant()
- [ ] Criar policy INSERT/UPDATE/DELETE com tenant_id = current_tenant()
- [ ] Implementar função current_tenant() no PostgreSQL
- [ ] Configurar context de tenant_id nas conexões

**Checklist de Verificação**:
- [ ] RLS ativo em todas as tabelas relevantes
- [ ] Policies testadas para cada operação CRUD
- [ ] Função current_tenant() retorna valor correto
- [ ] Isolamento entre tenants garantido

**Teste de Aceitação (Playwright)**:
```typescript
test('RLS impede acesso cruzado entre tenants', async ({ page }) => {
  // Login como tenant A, tentar acessar dados do tenant B
  // Verificar que retorna vazio ou erro 403
});
```

---

## FASE 2: Sistema de Autenticação Multi-tenant

### Tarefas Executáveis

#### 2.1 Middleware de Autorização
**Descrição**: Implementar controle de acesso por papel e tenant

**Subtarefas**:
- [ ] Criar middleware de autenticação com tenant_id
- [ ] Implementar verificação de papéis (super_admin, tenant_admin, operator)
- [ ] Criar HOC para proteção de rotas por papel
- [ ] Implementar context de tenant atual
- [ ] Configurar redirecionamentos baseados em papel

**Checklist de Verificação**:
- [ ] Middleware bloqueia acesso não autorizado
- [ ] Papéis validados corretamente
- [ ] Context de tenant disponível em toda aplicação
- [ ] Redirecionamentos funcionam para cada papel
- [ ] Sessões mantêm tenant_id consistente

**Teste de Aceitação (Playwright)**:
```typescript
test('Controle de acesso por papéis', async ({ page }) => {
  // Login como operador, tentar acessar área de super-admin
  // Verificar redirecionamento ou erro 403
  // Testar acesso correto para cada papel
});
```

#### 2.2 Interface de Login e Seleção de Tenant
**Descrição**: UI para autenticação e seleção de contexto

**Subtarefas**:
- [ ] Remover componentes boilerplate de autenticação
- [ ] Criar tela de login personalizada
- [ ] Implementar seleção de tenant (se usuário tem acesso a múltiplos)
- [ ] Criar dashboard específico por papel
- [ ] Implementar logout com limpeza de contexto

**Checklist de Verificação**:
- [ ] Login funciona com Google OAuth
- [ ] Seleção de tenant persiste na sessão
- [ ] Dashboard correto exibido por papel
- [ ] Logout limpa contexto completamente
- [ ] UI responsiva e acessível

**Teste de Aceitação (Playwright)**:
```typescript
test('Fluxo completo de autenticação', async ({ page }) => {
  // Login com Google OAuth
  // Selecionar tenant (se aplicável)
  // Verificar dashboard correto
  // Fazer logout e verificar limpeza
});
```

---

## FASE 3: Gestão de Agentes e Templates (Super-Admin)

### Tarefas Executáveis

#### 3.1 CRUD de Agentes Globais
**Descrição**: Interface para Super-Admin gerenciar agentes

**Subtarefas**:
- [ ] Criar página de listagem de agentes
- [ ] Implementar formulário de criação/edição de agente
- [ ] Validar campos obrigatórios por tipo de agente
- [ ] Implementar preview de prompts
- [ ] Adicionar funcionalidade de teste de agente

**Tipos de Agente e Validações**:
- `ocr`: webhook_url, model, system_prompt
- `extract_structured`: responsible_keys[], system_prompt, output_type
- `extract_html`: webhook_url, system_prompt
- `translator`: target_lang, system_prompt, model

**Checklist de Verificação**:
- [ ] CRUD completo funciona para todos os tipos
- [ ] Validações específicas por tipo implementadas
- [ ] Preview de prompts funciona
- [ ] Teste de agente retorna resposta válida
- [ ] Interface intuitiva e responsiva

**Teste de Aceitação (Playwright)**:
```typescript
test('Gestão de agentes pelo Super-Admin', async ({ page }) => {
  // Login como super-admin
  // Criar agente OCR com campos obrigatórios
  // Editar agente e verificar persistência
  // Testar validações de campos
  // Deletar agente e confirmar remoção
});
```

#### 3.2 CRUD de Templates HTML
**Descrição**: Gestão de templates para renderização final

**Subtarefas**:
- [ ] Criar interface de listagem de templates
- [ ] Implementar editor HTML com preview
- [ ] Adicionar sistema de variáveis {{key}}
- [ ] Implementar validação de sintaxe HTML
- [ ] Criar biblioteca de templates padrão

**Checklist de Verificação**:
- [ ] Editor HTML funciona com syntax highlighting
- [ ] Preview renderiza template com dados de exemplo
- [ ] Sistema de variáveis substitui corretamente
- [ ] Validação HTML impede templates inválidos
- [ ] Templates padrão disponíveis

**Teste de Aceitação (Playwright)**:
```typescript
test('Gestão de templates HTML', async ({ page }) => {
  // Criar template com variáveis {{nome}}, {{cpf}}
  // Testar preview com dados de exemplo
  // Validar HTML inválido é rejeitado
  // Editar template e verificar mudanças
});
```

---

## FASE 4: Workflow Builder com Grupos e Review Gates

### Tarefas Executáveis

#### 4.1 Interface Visual do Workflow Builder
**Descrição**: Drag-and-drop para construir workflows

**Subtarefas**:
- [ ] Implementar canvas de workflow com React Flow
- [ ] Criar paleta de nós (agent, group, review_gate, translator, render)
- [ ] Implementar drag-and-drop de nós
- [ ] Adicionar conexões entre nós
- [ ] Implementar validação de estrutura do workflow

**Tipos de Nós**:
- `agent`: Selecionar agente existente
- `group`: Agrupar múltiplos agentes extract_structured
- `review_gate`: Definir input (agent ou group)
- `translator`: Agente tradutor + target_lang
- `render`: Template para renderização final

**Checklist de Verificação**:
- [ ] Todos os tipos de nós podem ser adicionados
- [ ] Conexões entre nós funcionam corretamente
- [ ] Validação impede estruturas inválidas
- [ ] Interface intuitiva e responsiva
- [ ] Workflow pode ser salvo e carregado

**Teste de Aceitação (Playwright)**:
```typescript
test('Workflow Builder visual', async ({ page }) => {
  // Arrastar nó OCR para canvas
  // Adicionar grupo com 3 extratores
  // Conectar OCR ao grupo
  // Adicionar review gate após grupo
  // Salvar workflow e verificar JSON
});
```

#### 4.2 Configuração de Grupos de Extratores
**Descrição**: Interface para configurar agregação de agentes

**Subtarefas**:
- [ ] Modal de configuração de grupo
- [ ] Seleção múltipla de agentes extract_structured
- [ ] Configuração de ordem de execução
- [ ] Preview de agregação de chaves
- [ ] Validação de conflitos de chaves

**Checklist de Verificação**:
- [ ] Grupo aceita apenas agentes extract_structured
- [ ] Ordem de execução pode ser definida
- [ ] Preview mostra resultado da agregação
- [ ] Conflitos de chaves são identificados
- [ ] Configuração persiste corretamente

**Teste de Aceitação (Playwright)**:
```typescript
test('Configuração de grupos de extratores', async ({ page }) => {
  // Criar grupo com agentes que extraem chaves diferentes
  // Configurar ordem de execução
  // Testar preview de agregação
  // Verificar tratamento de conflitos
});
```

#### 4.3 Configuração de Review Gates
**Descrição**: Definir pontos de revisão humana

**Subtarefas**:
- [ ] Modal de configuração de review gate
- [ ] Seleção de input (agent ou group)
- [ ] Preview das chaves que serão revisadas
- [ ] Configuração de campos obrigatórios
- [ ] Validação de posicionamento no workflow

**Checklist de Verificação**:
- [ ] Review gate pode referenciar agent ou group
- [ ] Preview mostra chaves corretas do input
- [ ] Campos obrigatórios podem ser definidos
- [ ] Posicionamento no workflow é validado
- [ ] Configuração salva corretamente

**Teste de Aceitação (Playwright)**:
```typescript
test('Configuração de review gates', async ({ page }) => {
  // Adicionar review gate após grupo
  // Configurar input como group
  // Verificar preview das chaves
  // Definir campos obrigatórios
  // Salvar e validar configuração
});
```

---

## FASE 5: Sistema de Jobs e Integração n8n

### Tarefas Executáveis

#### 5.1 Execução de Jobs com Estados
**Descrição**: Sistema de execução com controle de estados

**Subtarefas**:
- [ ] Implementar máquina de estados do job
- [ ] Criar interface de upload de PDF
- [ ] Implementar validação de token antes da execução
- [ ] Configurar upload para MinIO (dev) com prefixo tenant
- [ ] Implementar retry e tratamento de erros
- [ ] Configurar Vercel Blob para produção

**Estados do Job**:
`queued → processing → review:<gate_id> → translating → review:<gate_id> → done | failed`

**Checklist de Verificação**:
- [ ] Estados do job transitam corretamente
- [ ] Upload de PDF funciona com validação
- [ ] Token obrigatório é verificado antes da execução
- [ ] Arquivos são organizados por tenant no storage
- [ ] URLs temporárias gerenciadas pelo n8n
- [ ] Retry funciona para falhas temporárias

**Teste de Aceitação (Playwright)**:
```typescript
test('Execução de job com estados', async ({ page }) => {
  // Selecionar workflow com token configurado
  // Fazer upload de PDF
  // Verificar transição de estados
  // Confirmar arquivo no S3 com prefixo correto
});
```

#### 5.2 Webhooks para Comunicação com n8n
**Descrição**: API para receber callbacks do n8n (sem autenticação inicial)

**Subtarefas**:
- [ ] Criar endpoints de webhook para cada tipo de agente
- [ ] Implementar validação de tenant_id nos payloads
- [ ] Configurar header auth opcional (configurável por webhook)
- [ ] Implementar processamento assíncrono
- [ ] Adicionar logging detalhado
- [ ] Criar endpoints para n8n gravar respostas no banco

**Endpoints de Webhook**:
- `POST /api/webhooks/job-start` - Início do processamento
- `POST /api/webhooks/agent-response` - Resposta de agente específico
- `POST /api/webhooks/review-gate` - Parada para revisão
- `POST /api/webhooks/job-complete` - Finalização
- `POST /api/webhooks/job-error` - Tratamento de erros

**Checklist de Verificação**:
- [ ] Todos os endpoints respondem corretamente
- [ ] Validação de tenant_id impede mismatch
- [ ] Header auth opcional funciona quando configurado
- [ ] Processamento assíncrono não bloqueia
- [ ] Logs permitem debugging
- [ ] n8n consegue gravar respostas no banco

**Teste de Aceitação (Playwright)**:
```typescript
test('Webhooks n8n com validação tenant', async ({ page }) => {
  // Simular callback com tenant_id correto
  // Verificar processamento correto
  // Testar callback com tenant_id incorreto
  // Confirmar erro 409 para mismatch
});
```

#### 5.3 Configuração de Tokens LLM
**Descrição**: Gestão de tokens por tenant e workflow

**Subtarefas**:
- [ ] Interface para configurar tokens por workflow
- [ ] Validação de token antes de iniciar job
- [ ] Sistema de override de token por agente
- [ ] Criptografia de tokens no banco
- [ ] Modal de configuração obrigatória

**Checklist de Verificação**:
- [ ] Tokens são criptografados no banco
- [ ] Validação bloqueia job sem token
- [ ] Override por agente funciona
- [ ] Modal aparece quando token falta
- [ ] Precedência de tokens está correta

**Teste de Aceitação (Playwright)**:
```typescript
test('Configuração obrigatória de tokens', async ({ page }) => {
  // Tentar iniciar job sem token configurado
  // Verificar modal de configuração obrigatória
  // Configurar token e tentar novamente
  // Confirmar job inicia corretamente
});
```

---

## FASE 6: Review Gates e Interface de Revisão

### Tarefas Executáveis

#### 6.1 Tela de Revisão com PDF Viewer
**Descrição**: Interface split com PDF e formulário de chaves

**Subtarefas**:
- [ ] Implementar PDF viewer responsivo (lado esquerdo)
- [ ] Criar formulário dinâmico de chaves (lado direito)
- [ ] Implementar navegação entre páginas do PDF
- [ ] Adicionar zoom e ferramentas de visualização
- [ ] Configurar layout responsivo split-screen

**Checklist de Verificação**:
- [ ] PDF carrega e exibe corretamente
- [ ] Formulário mostra chaves do input correto
- [ ] Navegação entre páginas funciona
- [ ] Zoom e ferramentas respondem
- [ ] Layout adapta a diferentes telas

**Teste de Aceitação (Playwright)**:
```typescript
test('Interface de revisão split-screen', async ({ page }) => {
  // Abrir job em review gate
  // Verificar PDF carregado à esquerda
  // Confirmar formulário de chaves à direita
  // Testar navegação e zoom do PDF
  // Verificar responsividade
});
```

#### 6.2 Edição e Aprovação de Chaves
**Descrição**: Formulário para editar chaves extraídas

**Subtarefas**:
- [ ] Renderizar campos baseados nas chaves do input
- [ ] Implementar validação de campos obrigatórios
- [ ] Adicionar funcionalidade de inserir nova chave
- [ ] Implementar histórico de mudanças
- [ ] Criar botões de aprovar/rejeitar

**Checklist de Verificação**:
- [ ] Campos renderizam com valores corretos
- [ ] Validação impede aprovação com campos vazios
- [ ] Novas chaves podem ser adicionadas
- [ ] Histórico registra todas as mudanças
- [ ] Aprovação avança o workflow

**Teste de Aceitação (Playwright)**:
```typescript
test('Edição e aprovação de chaves', async ({ page }) => {
  // Editar valor de chave existente
  // Adicionar nova chave não extraída
  // Tentar aprovar com campo obrigatório vazio
  // Preencher e aprovar com sucesso
  // Verificar avanço do workflow
});
```

#### 6.3 Auditoria de Mudanças
**Descrição**: Registro detalhado de todas as edições

**Subtarefas**:
- [ ] Implementar logging de mudanças em key_audit
- [ ] Registrar source_agent_id para cada chave
- [ ] Calcular métricas de acurácia por agente
- [ ] Criar interface de visualização de auditoria
- [ ] Implementar relatórios de performance

**Checklist de Verificação**:
- [ ] Todas as mudanças são registradas
- [ ] Source agent é identificado corretamente
- [ ] Métricas de acurácia são calculadas
- [ ] Interface de auditoria é clara
- [ ] Relatórios são precisos

**Teste de Aceitação (Playwright)**:
```typescript
test('Auditoria completa de mudanças', async ({ page }) => {
  // Fazer mudanças em chaves de diferentes agentes
  // Verificar registro em key_audit
  // Confirmar source_agent_id correto
  // Calcular acurácia do agente
  // Visualizar relatório de auditoria
});
```

---

## FASE 7: Sistema de Clonagem e Personalização

### Tarefas Executáveis

#### 7.1 Clonagem de Workflows Globais
**Descrição**: Permitir tenant clonar e personalizar workflows

**Subtarefas**:
- [ ] Implementar botão "Clonar" em workflows globais
- [ ] Criar processo de clonagem deep copy
- [ ] Associar clone ao tenant atual
- [ ] Preservar estrutura original (ordem, grupos, gates)
- [ ] Permitir edição apenas de prompts e HTML

**Checklist de Verificação**:
- [ ] Clone cria cópia independente no tenant
- [ ] Estrutura do workflow é preservada
- [ ] Apenas prompts e HTML são editáveis
- [ ] Clone não afeta workflow original
- [ ] Tenant pode usar clone normalmente

**Teste de Aceitação (Playwright)**:
```typescript
test('Clonagem de workflow global', async ({ page }) => {
  // Login como tenant admin
  // Clonar workflow global disponível
  // Verificar clone criado no tenant
  // Tentar editar estrutura (deve falhar)
  // Editar prompt de agente (deve funcionar)
});
```

#### 7.2 Edição Restrita de Clones
**Descrição**: Interface para editar apenas prompts e HTML

**Subtarefas**:
- [ ] Criar interface de edição de clone
- [ ] Bloquear edição de estrutura do workflow
- [ ] Permitir edição de prompts de agentes
- [ ] Permitir edição de HTML de templates
- [ ] Implementar validação de restrições

**Checklist de Verificação**:
- [ ] Interface mostra apenas campos editáveis
- [ ] Estrutura do workflow não pode ser alterada
- [ ] Prompts podem ser editados livremente
- [ ] HTML de templates pode ser personalizado
- [ ] Validações impedem mudanças não permitidas

**Teste de Aceitação (Playwright)**:
```typescript
test('Edição restrita de clone', async ({ page }) => {
  // Abrir clone para edição
  // Verificar campos de estrutura desabilitados
  // Editar prompt de agente
  // Editar HTML de template
  // Salvar e verificar mudanças
});
```

#### 7.3 Clonagem de Agentes e Templates
**Descrição**: Permitir clonagem de recursos globais

**Subtarefas**:
- [ ] Implementar clonagem de agentes globais
- [ ] Implementar clonagem de templates globais
- [ ] Criar interface de seleção para clonagem
- [ ] Associar clones ao tenant
- [ ] Permitir edição completa de clones

**Checklist de Verificação**:
- [ ] Agentes globais podem ser clonados
- [ ] Templates globais podem ser clonados
- [ ] Clones são associados ao tenant correto
- [ ] Clones podem ser editados completamente
- [ ] Clones não afetam recursos originais

**Teste de Aceitação (Playwright)**:
```typescript
test('Clonagem de agentes e templates', async ({ page }) => {
  // Clonar agente global para tenant
  // Clonar template global para tenant
  // Editar clone de agente
  // Editar clone de template
  // Usar clones em workflow do tenant
});
```

---

## FASE 8: Testes E2E e Validação Final

### Tarefas Executáveis

#### 8.1 Suite de Testes Completa
**Descrição**: Testes E2E cobrindo todos os fluxos principais

**Subtarefas**:
- [ ] Configurar Playwright com múltiplos usuários
- [ ] Criar testes para cada papel (Super-Admin, Admin, Operador)
- [ ] Implementar testes de isolamento entre tenants
- [ ] Criar testes de fluxo completo de tradução
- [ ] Implementar testes de performance básicos

**Cenários de Teste**:
1. **Super-Admin**: Criar tenant, agentes, templates, workflows
2. **Admin Tenant**: Clonar recursos, gerenciar usuários
3. **Operador**: Executar job, revisar gates, baixar resultado
4. **Isolamento**: Verificar RLS entre tenants
5. **Fluxo Completo**: OCR → Grupo → Review → Tradução → Review → PDF

**Checklist de Verificação**:
- [ ] Todos os papéis têm testes específicos
- [ ] Isolamento entre tenants é validado
- [ ] Fluxo completo funciona end-to-end
- [ ] Performance atende requisitos básicos
- [ ] Testes são estáveis e confiáveis

**Teste de Aceitação (Playwright)**:
```typescript
test('Fluxo completo de tradução', async ({ page }) => {
  // Super-admin cria workflow completo
  // Operador clona e configura token
  // Upload de PDF e execução
  // Revisão em cada gate
  // Download do PDF final traduzido
});
```

#### 8.2 Validação dos Critérios de Aceite
**Descrição**: Verificar todos os critérios definidos no brief

**Critérios de Aceite (do Brief)**:
1. ✅ Criar workflow: OCR → grupo(3 extratores) → review(g_ex) → tradutor → review(a_trad) → render
2. ✅ Operador clona workflow, edita prompts/HTML, sem mudar ordem/grupos/gates
3. ✅ Sem token no Workflow → 422 e modal; com token → criação e disparo
4. ✅ Disparo envia tenant_id e token_ref; n8n retorna review com keys + key_sources
5. ✅ Aprovação avança para tradutor, nova review e PDF final
6. ✅ RLS impede acesso cruzado entre tenants

**Subtarefas**:
- [ ] Implementar teste para cada critério de aceite
- [ ] Validar comportamento de erro 422 sem token
- [ ] Testar comunicação completa com n8n
- [ ] Verificar agregação de chaves em grupos
- [ ] Confirmar isolamento total entre tenants

**Checklist de Verificação**:
- [ ] Todos os 6 critérios passam nos testes
- [ ] Comportamentos de erro são validados
- [ ] Integração n8n funciona corretamente
- [ ] Agregação de grupos está correta
- [ ] RLS é 100% efetivo

**Teste de Aceitação (Playwright)**:
```typescript
test('Validação completa dos critérios de aceite', async ({ page }) => {
  // Executar cada um dos 6 critérios
  // Verificar comportamentos esperados
  // Confirmar isolamento entre tenants
  // Validar integração n8n
});
```

---

## Configurações de Ambiente

### Desenvolvimento (MinIO)
```env
# Storage MinIO (Desenvolvimento)
STORAGE_BUCKET_NAME=service-doc-temp
STORAGE_ACCESS_KEY_ID=J0fRLZqrfgW9VF7tPfyW
STORAGE_SECRET_ACCESS_KEY=txaUOkO6n5aFBbW5eI9RkBtoW5xR7Cf3evar1mXC
STORAGE_ENDPOINT=https://s3.atendamelhor.com
STORAGE_FORCE_PATH_STYLE=true

# n8n Integration
N8N_WEBHOOK_BASE_URL=http://localhost:5678/webhook
N8N_WEBHOOK_AUTH_HEADER=optional-auth-token

# Deploy
DEPLOY_PLATFORM=vercel
MONITORING=simple-logs
```

### Produção (Vercel)
```env
# Vercel Blob (Produção)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# n8n Production
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook
```

## Cronograma de Desenvolvimento

### Sequência de Execução

**Semana 1-2**: FASE 1 (Schema) + FASE 2 (Auth)
- Fundação sólida com banco e autenticação
- Testes de RLS e isolamento

**Semana 3-4**: FASE 3 (Agentes/Templates) + FASE 4 (Workflow Builder)
- Interfaces de gestão para Super-Admin (com agentes pré-escritos)
- Workflow Builder visual

**Semana 5-6**: FASE 5 (Jobs/n8n) + FASE 6 (Review Gates)
- Sistema de execução (URLs temporárias)
- Interface de revisão

**Semana 7**: FASE 7 (Clonagem)
- Sistema de personalização

**Semana 8**: FASE 8 (Testes E2E)
- Validação completa
- Correções finais

### Marcos de Validação

**Marco 1** (Fim Semana 2): Autenticação multi-tenant funcional
**Marco 2** (Fim Semana 4): Workflow Builder operacional
**Marco 3** (Fim Semana 6): Fluxo completo de job funciona
**Marco 4** (Fim Semana 8): Sistema pronto para produção na Vercel

---

## Checklist Geral de Conclusão

### Funcionalidades Core
- [ ] Multi-tenancy com RLS 100% funcional
- [ ] Autenticação com 3 papéis implementada
- [ ] CRUD completo de agentes e templates
- [ ] Workflow Builder visual operacional
- [ ] Sistema de jobs com estados
- [ ] Review gates com interface de revisão
- [ ] Clonagem e personalização funcionando
- [ ] Integração n8n com webhooks

### Qualidade e Testes
- [ ] Suite E2E Playwright completa
- [ ] Todos os critérios de aceite validados
- [ ] RLS testado entre tenants
- [ ] Performance básica validada
- [ ] Tratamento de erros implementado

### Documentação
- [ ] Documentação técnica atualizada
- [ ] Guias de uso por papel
- [ ] API documentation
- [ ] Deployment guide

### Deploy e Produção
- [ ] Configuração de ambiente
- [ ] Variáveis de ambiente documentadas
- [ ] Scripts de migração
- [ ] Monitoramento básico

---

## Especificações Técnicas Definidas

### 1. Integração n8n
- **Status**: Instância já instalada e funcionando
- **Webhooks**: Sem autenticação inicial (header auth opcional)
- **Endpoints**: Específicos para cada tipo de agente
- **Funcionalidade**: n8n grava respostas diretamente no banco

### 2. Storage
- **Desenvolvimento**: MinIO com credenciais fornecidas
- **Produção**: Vercel Blob (já configurado no projeto)
- **URLs**: Temporárias gerenciadas pelo n8n
- **Organização**: Prefixo por tenant

### 3. Deploy e Monitoramento
- **Plataforma**: Vercel (MVP rápido)
- **Banco**: PostgreSQL externo
- **Monitoramento**: Logs simples
- **Ambiente**: Configurações específicas definidas

### 4. Dados de Exemplo
- **Agentes**: Já escritos e prontos para uso
- **Workflows**: Baseados nos agentes existentes
- **Super-Admin**: super@admin.com
- **Tenant de Teste**: "Empresa Demo"
- **PDFs**: Documentos brasileiros para validação

Todas as especificações técnicas estão definidas e o desenvolvimento pode iniciar imediatamente seguindo o planejamento executável acima.