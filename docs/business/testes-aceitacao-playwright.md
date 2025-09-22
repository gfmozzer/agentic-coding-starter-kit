# Testes de Aceitação com Playwright - Sistema Multi-tenant de Tradução

## Configuração Base dos Testes

### Estrutura de Arquivos
```
tests/
├── fixtures/
│   ├── users.ts          # Fixtures de usuários por papel
│   ├── tenants.ts        # Fixtures de tenants
│   └── sample-data.ts    # Dados de exemplo
├── helpers/
│   ├── auth.ts           # Helpers de autenticação
│   ├── database.ts       # Helpers de banco de dados
│   └── api.ts            # Helpers de API
├── e2e/
│   ├── auth/             # Testes de autenticação
│   ├── super-admin/      # Testes específicos do Super-Admin
│   ├── tenant-admin/     # Testes específicos do Admin Tenant
│   ├── operator/         # Testes específicos do Operador
│   ├── workflows/        # Testes de workflows
│   └── integration/      # Testes de integração
└── playwright.config.ts  # Configuração do Playwright
```

### Configuração Playwright
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## FASE 1: Testes de Schema e RLS

### 1.1 Teste de Schema Multi-tenant
```typescript
// tests/e2e/database/schema.spec.ts
import { test, expect } from '@playwright/test';
import { setupDatabase, cleanupDatabase } from '../../helpers/database';

test.describe('Schema Multi-tenant', () => {
  test.beforeEach(async () => {
    await setupDatabase();
  });

  test.afterEach(async () => {
    await cleanupDatabase();
  });

  test('deve criar todas as tabelas com tenant_id', async ({ page }) => {
    // Verificar que todas as tabelas foram criadas
    const tables = await page.evaluate(async () => {
      const response = await fetch('/api/test/schema/tables');
      return response.json();
    });

    expect(tables).toContain('tenants');
    expect(tables).toContain('users');
    expect(tables).toContain('agents');
    expect(tables).toContain('workflows');
    expect(tables).toContain('jobs');
    expect(tables).toContain('review_sessions');
    expect(tables).toContain('key_audit');
  });

  test('deve ter constraints de integridade referencial', async ({ page }) => {
    // Tentar inserir registro com tenant_id inexistente
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/schema/constraint-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'agents',
            data: { tenant_id: 'inexistente', name: 'Test Agent' }
          })
        });
        return { success: response.ok, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(400); // Constraint violation
  });
});
```

### 1.2 Teste de RLS (Row-Level Security)
```typescript
// tests/e2e/database/rls.spec.ts
import { test, expect } from '@playwright/test';
import { createTenant, createUser, loginAs } from '../../helpers/auth';

test.describe('Row-Level Security', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let user1: any;
  let user2: any;

  test.beforeEach(async () => {
    // Criar dois tenants e usuários
    tenant1Id = await createTenant('Tenant 1');
    tenant2Id = await createTenant('Tenant 2');
    
    user1 = await createUser({
      email: 'user1@tenant1.com',
      tenantId: tenant1Id,
      role: 'operator'
    });
    
    user2 = await createUser({
      email: 'user2@tenant2.com', 
      tenantId: tenant2Id,
      role: 'operator'
    });
  });

  test('deve impedir acesso cruzado entre tenants', async ({ page }) => {
    // Login como usuário do tenant 1
    await loginAs(page, user1);
    
    // Criar um agente no tenant 1
    await page.goto('/agents');
    await page.click('[data-testid="create-agent"]');
    await page.fill('[data-testid="agent-name"]', 'Agent Tenant 1');
    await page.selectOption('[data-testid="agent-type"]', 'ocr');
    await page.fill('[data-testid="webhook-url"]', 'https://example.com/ocr');
    await page.click('[data-testid="save-agent"]');
    
    // Verificar que agente foi criado
    await expect(page.locator('text=Agent Tenant 1')).toBeVisible();
    
    // Fazer logout e login como usuário do tenant 2
    await page.click('[data-testid="logout"]');
    await loginAs(page, user2);
    
    // Verificar que não vê agentes do tenant 1
    await page.goto('/agents');
    await expect(page.locator('text=Agent Tenant 1')).not.toBeVisible();
    
    // Tentar acessar agente do tenant 1 via API direta
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/agents');
      const agents = await res.json();
      return agents.filter(agent => agent.name === 'Agent Tenant 1');
    });
    
    expect(response).toHaveLength(0);
  });

  test('deve permitir acesso apenas aos dados do próprio tenant', async ({ page }) => {
    await loginAs(page, user1);
    
    // Criar dados no tenant 1
    const agentResponse = await page.evaluate(async () => {
      return fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Agent',
          type: 'ocr',
          webhook_url: 'https://example.com'
        })
      }).then(res => res.json());
    });
    
    // Verificar que pode acessar seus próprios dados
    const ownData = await page.evaluate(async () => {
      const res = await fetch('/api/agents');
      return res.json();
    });
    
    expect(ownData.some(agent => agent.name === 'Test Agent')).toBe(true);
  });
});
```

---

## FASE 2: Testes de Autenticação Multi-tenant

### 2.1 Teste de Controle de Acesso por Papéis
```typescript
// tests/e2e/auth/role-access.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs, createUserWithRole } from '../../helpers/auth';

test.describe('Controle de Acesso por Papéis', () => {
  test('Super-Admin deve acessar todas as áreas', async ({ page }) => {
    const superAdmin = await createUserWithRole('super_admin');
    await loginAs(page, superAdmin);
    
    // Verificar acesso ao dashboard de super-admin
    await page.goto('/super-admin');
    await expect(page.locator('[data-testid="super-admin-dashboard"]')).toBeVisible();
    
    // Verificar acesso à gestão de tenants
    await page.goto('/super-admin/tenants');
    await expect(page.locator('[data-testid="tenants-list"]')).toBeVisible();
    
    // Verificar acesso à gestão de agentes globais
    await page.goto('/super-admin/agents');
    await expect(page.locator('[data-testid="global-agents-list"]')).toBeVisible();
  });

  test('Tenant Admin deve acessar apenas área do tenant', async ({ page }) => {
    const tenantAdmin = await createUserWithRole('tenant_admin');
    await loginAs(page, tenantAdmin);
    
    // Deve acessar dashboard do tenant
    await page.goto('/tenant');
    await expect(page.locator('[data-testid="tenant-dashboard"]')).toBeVisible();
    
    // Não deve acessar área de super-admin
    await page.goto('/super-admin');
    await expect(page.locator('text=403')).toBeVisible();
    
    // Deve ser redirecionado para área correta
    await expect(page).toHaveURL('/tenant');
  });

  test('Operador deve acessar apenas execução de jobs', async ({ page }) => {
    const operator = await createUserWithRole('operator');
    await loginAs(page, operator);
    
    // Deve acessar área de jobs
    await page.goto('/jobs');
    await expect(page.locator('[data-testid="jobs-list"]')).toBeVisible();
    
    // Não deve acessar gestão de workflows
    await page.goto('/workflows');
    await expect(page.locator('text=403')).toBeVisible();
    
    // Não deve acessar área de admin
    await page.goto('/tenant/admin');
    await expect(page.locator('text=403')).toBeVisible();
  });
});
```

### 2.2 Teste de Fluxo de Autenticação
```typescript
// tests/e2e/auth/login-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Fluxo de Autenticação', () => {
  test('deve fazer login com Google OAuth', async ({ page }) => {
    await page.goto('/login');
    
    // Verificar que tela de login está visível
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Simular clique no botão Google (em ambiente de teste)
    await page.click('[data-testid="google-login"]');
    
    // Em ambiente de teste, simular callback do Google
    await page.goto('/auth/callback?code=test_code&state=test_state');
    
    // Verificar redirecionamento para dashboard correto
    await expect(page).toHaveURL(/\/(super-admin|tenant|jobs)/);
  });

  test('deve selecionar tenant quando usuário tem múltiplos acessos', async ({ page }) => {
    // Criar usuário com acesso a múltiplos tenants
    const multiTenantUser = await createUserWithRole('tenant_admin', {
      tenants: ['tenant1', 'tenant2']
    });
    
    await loginAs(page, multiTenantUser);
    
    // Deve mostrar seletor de tenant
    await expect(page.locator('[data-testid="tenant-selector"]')).toBeVisible();
    
    // Selecionar tenant
    await page.selectOption('[data-testid="tenant-selector"]', 'tenant1');
    await page.click('[data-testid="select-tenant"]');
    
    // Verificar que contexto foi definido
    const tenantContext = await page.evaluate(() => {
      return localStorage.getItem('current_tenant_id');
    });
    
    expect(tenantContext).toBe('tenant1');
  });

  test('deve fazer logout e limpar contexto', async ({ page }) => {
    const user = await createUserWithRole('operator');
    await loginAs(page, user);
    
    // Verificar que está logado
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Fazer logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');
    
    // Verificar redirecionamento para login
    await expect(page).toHaveURL('/login');
    
    // Verificar que contexto foi limpo
    const session = await page.evaluate(() => {
      return {
        tenant: localStorage.getItem('current_tenant_id'),
        user: localStorage.getItem('user_session')
      };
    });
    
    expect(session.tenant).toBeNull();
    expect(session.user).toBeNull();
  });
});
```

---

## FASE 3: Testes de Gestão de Agentes e Templates

### 3.1 Teste de CRUD de Agentes
```typescript
// tests/e2e/super-admin/agents.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from '../../helpers/auth';

test.describe('Gestão de Agentes - Super Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/agents');
  });

  test('deve criar agente OCR com validações', async ({ page }) => {
    await page.click('[data-testid="create-agent"]');
    
    // Preencher formulário de agente OCR
    await page.fill('[data-testid="agent-name"]', 'OCR Agent Test');
    await page.selectOption('[data-testid="agent-type"]', 'ocr');
    
    // Tentar salvar sem webhook_url (deve falhar)
    await page.click('[data-testid="save-agent"]');
    await expect(page.locator('text=Webhook URL é obrigatório')).toBeVisible();
    
    // Preencher campos obrigatórios
    await page.fill('[data-testid="webhook-url"]', 'https://api.example.com/ocr');
    await page.fill('[data-testid="system-prompt"]', 'Extract text from image');
    await page.selectOption('[data-testid="model"]', 'gpt-4-vision');
    
    // Salvar agente
    await page.click('[data-testid="save-agent"]');
    
    // Verificar que foi criado
    await expect(page.locator('text=OCR Agent Test')).toBeVisible();
    await expect(page.locator('text=Agente criado com sucesso')).toBeVisible();
  });

  test('deve criar agente extrator estruturado', async ({ page }) => {
    await page.click('[data-testid="create-agent"]');
    
    await page.fill('[data-testid="agent-name"]', 'Extrator CPF');
    await page.selectOption('[data-testid="agent-type"]', 'extract_structured');
    
    // Adicionar chaves responsáveis
    await page.click('[data-testid="add-responsible-key"]');
    await page.fill('[data-testid="responsible-key-0"]', 'cpf');
    await page.click('[data-testid="add-responsible-key"]');
    await page.fill('[data-testid="responsible-key-1"]', 'nome');
    
    await page.fill('[data-testid="system-prompt"]', 'Extract CPF and name from document');
    await page.selectOption('[data-testid="output-type"]', 'json');
    
    await page.click('[data-testid="save-agent"]');
    
    // Verificar criação
    await expect(page.locator('text=Extrator CPF')).toBeVisible();
    
    // Verificar que chaves foram salvas
    await page.click('[data-testid="edit-agent-Extrator CPF"]');
    await expect(page.locator('[data-testid="responsible-key-0"]')).toHaveValue('cpf');
    await expect(page.locator('[data-testid="responsible-key-1"]')).toHaveValue('nome');
  });

  test('deve testar agente com preview', async ({ page }) => {
    // Criar agente primeiro
    await page.click('[data-testid="create-agent"]');
    await page.fill('[data-testid="agent-name"]', 'Test Agent');
    await page.selectOption('[data-testid="agent-type"]', 'extract_structured');
    await page.fill('[data-testid="system-prompt"]', 'Extract data: {{input}}');
    
    // Testar preview do prompt
    await page.fill('[data-testid="test-input"]', 'Sample document text');
    await page.click('[data-testid="preview-prompt"]');
    
    // Verificar que preview mostra prompt processado
    await expect(page.locator('[data-testid="prompt-preview"]'))
      .toContainText('Extract data: Sample document text');
    
    // Testar agente (mock da resposta)
    await page.click('[data-testid="test-agent"]');
    
    // Verificar resposta do teste
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible();
  });

  test('deve editar e deletar agente', async ({ page }) => {
    // Criar agente para editar
    await page.click('[data-testid="create-agent"]');
    await page.fill('[data-testid="agent-name"]', 'Agent to Edit');
    await page.selectOption('[data-testid="agent-type"]', 'ocr');
    await page.fill('[data-testid="webhook-url"]', 'https://example.com');
    await page.click('[data-testid="save-agent"]');
    
    // Editar agente
    await page.click('[data-testid="edit-agent-Agent to Edit"]');
    await page.fill('[data-testid="agent-name"]', 'Agent Edited');
    await page.click('[data-testid="save-agent"]');
    
    // Verificar edição
    await expect(page.locator('text=Agent Edited')).toBeVisible();
    await expect(page.locator('text=Agent to Edit')).not.toBeVisible();
    
    // Deletar agente
    await page.click('[data-testid="delete-agent-Agent Edited"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verificar deleção
    await expect(page.locator('text=Agent Edited')).not.toBeVisible();
  });
});
```

### 3.2 Teste de CRUD de Templates
```typescript
// tests/e2e/super-admin/templates.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from '../../helpers/auth';

test.describe('Gestão de Templates - Super Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/templates');
  });

  test('deve criar template HTML com variáveis', async ({ page }) => {
    await page.click('[data-testid="create-template"]');
    
    await page.fill('[data-testid="template-name"]', 'Documento Traduzido');
    
    // Preencher HTML com variáveis
    const htmlContent = `
      <html>
        <body>
          <h1>Documento Traduzido</h1>
          <p><strong>Nome:</strong> {{nome}}</p>
          <p><strong>CPF:</strong> {{cpf}}</p>
          <p><strong>Endereço:</strong> {{endereco}}</p>
          <div class="content">
            {{conteudo_traduzido}}
          </div>
        </body>
      </html>
    `;
    
    await page.fill('[data-testid="html-editor"]', htmlContent);
    
    // Testar preview com dados de exemplo
    await page.fill('[data-testid="preview-data"]', JSON.stringify({
      nome: 'João Silva',
      cpf: '123.456.789-00',
      endereco: 'Rua das Flores, 123',
      conteudo_traduzido: 'Conteúdo do documento traduzido...'
    }));
    
    await page.click('[data-testid="preview-template"]');
    
    // Verificar que preview renderiza corretamente
    const previewFrame = page.frameLocator('[data-testid="template-preview"]');
    await expect(previewFrame.locator('text=João Silva')).toBeVisible();
    await expect(previewFrame.locator('text=123.456.789-00')).toBeVisible();
    
    // Salvar template
    await page.click('[data-testid="save-template"]');
    
    await expect(page.locator('text=Documento Traduzido')).toBeVisible();
  });

  test('deve validar HTML inválido', async ({ page }) => {
    await page.click('[data-testid="create-template"]');
    
    await page.fill('[data-testid="template-name"]', 'Template Inválido');
    
    // HTML inválido (tag não fechada)
    await page.fill('[data-testid="html-editor"]', '<html><body><h1>Título</body></html>');
    
    await page.click('[data-testid="save-template"]');
    
    // Verificar erro de validação
    await expect(page.locator('text=HTML inválido')).toBeVisible();
  });

  test('deve usar templates da biblioteca padrão', async ({ page }) => {
    // Verificar que templates padrão estão disponíveis
    await expect(page.locator('[data-testid="template-Documento Simples"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-Relatório Completo"]')).toBeVisible();
    
    // Clonar template padrão
    await page.click('[data-testid="clone-template-Documento Simples"]');
    
    // Verificar que abre para edição
    await expect(page.locator('[data-testid="template-name"]')).toHaveValue('Documento Simples (Cópia)');
    
    // Modificar e salvar
    await page.fill('[data-testid="template-name"]', 'Meu Documento Personalizado');
    await page.click('[data-testid="save-template"]');
    
    await expect(page.locator('text=Meu Documento Personalizado')).toBeVisible();
  });
});
```

---

## FASE 4: Testes do Workflow Builder

### 4.1 Teste de Interface Visual
```typescript
// tests/e2e/workflows/builder.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from '../../helpers/auth';

test.describe('Workflow Builder Visual', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/workflows/builder');
  });

  test('deve criar workflow completo com drag-and-drop', async ({ page }) => {
    // Criar novo workflow
    await page.click('[data-testid="new-workflow"]');
    await page.fill('[data-testid="workflow-name"]', 'Workflow Completo');
    
    // Arrastar nó OCR para canvas
    await page.dragAndDrop(
      '[data-testid="node-palette-agent"]',
      '[data-testid="workflow-canvas"]'
    );
    
    // Configurar nó OCR
    await page.click('[data-testid="node-agent-1"]');
    await page.selectOption('[data-testid="select-agent"]', 'OCR Global');
    await page.click('[data-testid="save-node-config"]');
    
    // Adicionar grupo de extratores
    await page.dragAndDrop(
      '[data-testid="node-palette-group"]',
      '[data-testid="workflow-canvas"]'
    );
    
    // Configurar grupo
    await page.click('[data-testid="node-group-1"]');
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-0"]', 'Extrator CPF');
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-1"]', 'Extrator Endereço');
    await page.click('[data-testid="save-node-config"]');
    
    // Conectar OCR ao grupo
    await page.hover('[data-testid="node-agent-1"]');
    await page.dragAndDrop(
      '[data-testid="output-handle-agent-1"]',
      '[data-testid="input-handle-group-1"]'
    );
    
    // Adicionar review gate
    await page.dragAndDrop(
      '[data-testid="node-palette-review-gate"]',
      '[data-testid="workflow-canvas"]'
    );
    
    // Configurar review gate
    await page.click('[data-testid="node-review-gate-1"]');
    await page.selectOption('[data-testid="review-input"]', 'group-1');
    await page.click('[data-testid="required-field-cpf"]'); // Marcar CPF como obrigatório
    await page.click('[data-testid="save-node-config"]');
    
    // Conectar grupo ao review gate
    await page.dragAndDrop(
      '[data-testid="output-handle-group-1"]',
      '[data-testid="input-handle-review-gate-1"]'
    );
    
    // Salvar workflow
    await page.click('[data-testid="save-workflow"]');
    
    // Verificar que foi salvo
    await expect(page.locator('text=Workflow salvo com sucesso')).toBeVisible();
    
    // Verificar estrutura do workflow
    const workflowData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('current_workflow') || '{}');
    });
    
    expect(workflowData.nodes).toHaveLength(3); // OCR + Group + Review Gate
    expect(workflowData.edges).toHaveLength(2); // 2 conexões
  });

  test('deve validar estrutura do workflow', async ({ page }) => {
    // Tentar salvar workflow sem conexões
    await page.click('[data-testid="new-workflow"]');
    await page.fill('[data-testid="workflow-name"]', 'Workflow Inválido');
    
    // Adicionar apenas um nó sem conexões
    await page.dragAndDrop(
      '[data-testid="node-palette-agent"]',
      '[data-testid="workflow-canvas"]'
    );
    
    await page.click('[data-testid="save-workflow"]');
    
    // Verificar erro de validação
    await expect(page.locator('text=Workflow deve ter pelo menos uma conexão')).toBeVisible();
    
    // Tentar conectar nós incompatíveis
    await page.dragAndDrop(
      '[data-testid="node-palette-review-gate"]',
      '[data-testid="workflow-canvas"]'
    );
    
    // Tentar conectar review gate diretamente ao OCR (sem extrator)
    await page.dragAndDrop(
      '[data-testid="output-handle-agent-1"]',
      '[data-testid="input-handle-review-gate-1"]'
    );
    
    // Verificar erro de validação
    await expect(page.locator('text=Review gate deve receber dados de extrator ou grupo')).toBeVisible();
  });
});
```

### 4.2 Teste de Configuração de Grupos
```typescript
// tests/e2e/workflows/groups.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin, createSampleAgents } from '../../helpers/auth';

test.describe('Configuração de Grupos de Extratores', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await createSampleAgents(); // Criar agentes de exemplo
    await page.goto('/super-admin/workflows/builder');
  });

  test('deve configurar grupo com múltiplos extratores', async ({ page }) => {
    await page.click('[data-testid="new-workflow"]');
    
    // Adicionar grupo
    await page.dragAndDrop(
      '[data-testid="node-palette-group"]',
      '[data-testid="workflow-canvas"]'
    );
    
    // Abrir configuração do grupo
    await page.click('[data-testid="node-group-1"]');
    
    // Adicionar primeiro extrator
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-0"]', 'Extrator CPF');
    
    // Adicionar segundo extrator
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-1"]', 'Extrator Nome');
    
    // Adicionar terceiro extrator
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-2"]', 'Extrator Endereço');
    
    // Configurar ordem de execução
    await page.dragAndDrop(
      '[data-testid="agent-order-2"]', // Endereço
      '[data-testid="agent-order-0"]'  // Para primeira posição
    );
    
    // Verificar preview de agregação
    await page.click('[data-testid="preview-aggregation"]');
    
    const preview = await page.locator('[data-testid="aggregation-preview"]').textContent();
    expect(preview).toContain('endereco'); // Primeira chave
    expect(preview).toContain('cpf');      // Segunda chave
    expect(preview).toContain('nome');     // Terceira chave
    
    await page.click('[data-testid="save-node-config"]');
    
    // Verificar que configuração foi salva
    await page.click('[data-testid="node-group-1"]');
    await expect(page.locator('[data-testid="group-agent-0"]')).toHaveValue('Extrator Endereço');
  });

  test('deve detectar conflitos de chaves', async ({ page }) => {
    await page.click('[data-testid="new-workflow"]');
    
    // Adicionar grupo
    await page.dragAndDrop(
      '[data-testid="node-palette-group"]',
      '[data-testid="workflow-canvas"]'
    );
    
    await page.click('[data-testid="node-group-1"]');
    
    // Adicionar dois extratores que extraem a mesma chave
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-0"]', 'Extrator CPF v1');
    
    await page.click('[data-testid="add-agent-to-group"]');
    await page.selectOption('[data-testid="group-agent-1"]', 'Extrator CPF v2');
    
    // Verificar detecção de conflito
    await expect(page.locator('[data-testid="key-conflict-warning"]')).toBeVisible();
    await expect(page.locator('text=Conflito na chave "cpf"')).toBeVisible();
    
    // Verificar que mostra estratégia de resolução
    await expect(page.locator('text=Último valor será usado')).toBeVisible();
  });

  test('deve aceitar apenas agentes extract_structured', async ({ page }) => {
    await page.click('[data-testid="new-workflow"]');
    
    await page.dragAndDrop(
      '[data-testid="node-palette-group"]',
      '[data-testid="workflow-canvas"]'
    );
    
    await page.click('[data-testid="node-group-1"]');
    await page.click('[data-testid="add-agent-to-group"]');
    
    // Verificar que apenas agentes extract_structured aparecem na lista
    const options = await page.locator('[data-testid="group-agent-0"] option').allTextContents();
    
    expect(options).not.toContain('OCR Agent'); // Tipo OCR não deve aparecer
    expect(options).not.toContain('Tradutor EN'); // Tipo translator não deve aparecer
    expect(options).toContain('Extrator CPF'); // Tipo extract_structured deve aparecer
  });
});
```

---

## FASE 5: Testes de Jobs e Integração n8n

### 5.1 Teste de Execução de Jobs
```typescript
// tests/e2e/jobs/execution.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsOperator, createWorkflowWithToken } from '../../helpers/auth';
import { uploadTestPDF } from '../../helpers/files';

test.describe('Execução de Jobs', () => {
  let workflowId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
    workflowId = await createWorkflowWithToken();
  });

  test('deve executar job com token configurado', async ({ page }) => {
    await page.goto('/jobs');
    
    // Selecionar workflow
    await page.selectOption('[data-testid="workflow-select"]', workflowId);
    
    // Upload de PDF
    const fileInput = page.locator('[data-testid="pdf-upload"]');
    await fileInput.setInputFiles(await uploadTestPDF());
    
    // Verificar preview do PDF
    await expect(page.locator('[data-testid="pdf-preview"]')).toBeVisible();
    
    // Iniciar job
    await page.click('[data-testid="start-job"]');
    
    // Verificar que job foi criado
    await expect(page.locator('text=Job iniciado com sucesso')).toBeVisible();
    
    // Verificar estado inicial
    const jobRow = page.locator('[data-testid="job-row"]').first();
    await expect(jobRow.locator('[data-testid="job-status"]')).toContainText('queued');
    
    // Simular callback do n8n para início do processamento
    await page.evaluate(async (jobId) => {
      await fetch('/api/webhooks/job-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          tenant_id: 'current_tenant',
          status: 'processing'
        })
      });
    }, 'job-123');
    
    // Verificar mudança de estado
    await page.reload();
    await expect(jobRow.locator('[data-testid="job-status"]')).toContainText('processing');
  });

  test('deve bloquear execução sem token configurado', async ({ page }) => {
    // Criar workflow sem token
    const workflowWithoutToken = await createWorkflowWithoutToken();
    
    await page.goto('/jobs');
    await page.selectOption('[data-testid="workflow-select"]', workflowWithoutToken);
    
    const fileInput = page.locator('[data-testid="pdf-upload"]');
    await fileInput.setInputFiles(await uploadTestPDF());
    
    // Tentar iniciar job
    await page.click('[data-testid="start-job"]');
    
    // Verificar erro 422
    await expect(page.locator('text=Token LLM obrigatório')).toBeVisible();
    
    // Verificar que modal de configuração aparece
    await expect(page.locator('[data-testid="token-config-modal"]')).toBeVisible();
    
    // Configurar token
    await page.fill('[data-testid="llm-token"]', 'sk-test-token-123');
    await page.click('[data-testid="save-token"]');
    
    // Tentar novamente
    await page.click('[data-testid="start-job"]');
    
    // Verificar que agora funciona
    await expect(page.locator('text=Job iniciado com sucesso')).toBeVisible();
  });

  test('deve organizar arquivos por tenant no S3', async ({ page }) => {
    await page.goto('/jobs');
    
    await page.selectOption('[data-testid="workflow-select"]', workflowId);
    
    const fileInput = page.locator('[data-testid="pdf-upload"]');
    await fileInput.setInputFiles(await uploadTestPDF());
    
    await page.click('[data-testid="start-job"]');
    
    // Verificar que arquivo foi enviado com prefixo correto
    const uploadResponse = await page.evaluate(() => {
      return fetch('/api/test/s3/last-upload').then(res => res.json());
    });
    
    expect(uploadResponse.key).toMatch(/^tenant-[a-z0-9]+\/jobs\//);
    expect(uploadResponse.bucket).toBe('translator-documents');
  });
});
```

### 5.2 Teste de Webhooks n8n
```typescript
// tests/e2e/integration/webhooks.spec.ts
import { test, expect } from '@playwright/test';
import { createJob, createTenant } from '../../helpers/database';

test.describe('Webhooks n8n', () => {
  test('deve processar callback de review gate', async ({ page }) => {
    const tenantId = await createTenant('Test Tenant');
    const jobId = await createJob(tenantId, 'processing');
    
    // Simular callback do n8n para review gate
    const response = await page.evaluate(async ({ jobId, tenantId }) => {
      return fetch('/api/webhooks/review-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          tenant_id: tenantId,
          gate_id: 'gate-1',
          keys_data: {
            cpf: { value: '123.456.789-00', source_agent_id: 'agent-cpf' },
            nome: { value: 'João Silva', source_agent_id: 'agent-nome' }
          },
          status: 'review:gate-1'
        })
      }).then(res => ({ status: res.status, ok: res.ok }));
    }, { jobId, tenantId });
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    // Verificar que review session foi criada
    const reviewSession = await page.evaluate(async (jobId) => {
      const res = await fetch(`/api/jobs/${jobId}/review-sessions`);
      return res.json();
    }, jobId);
    
    expect(reviewSession).toHaveLength(1);
    expect(reviewSession[0].gate_id).toBe('gate-1');
    expect(reviewSession[0].keys_data.cpf.value).toBe('123.456.789-00');
  });

  test('deve rejeitar callback com tenant_id incorreto', async ({ page }) => {
    const tenantId1 = await createTenant('Tenant 1');
    const tenantId2 = await createTenant('Tenant 2');
    const jobId = await createJob(tenantId1, 'processing');
    
    // Tentar callback com tenant_id diferente
    const response = await page.evaluate(async ({ jobId, tenantId2 }) => {
      return fetch('/api/webhooks/review-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          tenant_id: tenantId2, // Tenant incorreto
          gate_id: 'gate-1',
          keys_data: {},
          status: 'review:gate-1'
        })
      }).then(res => ({ status: res.status, ok: res.ok }));
    }, { jobId, tenantId2 });
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(409); // Conflict - tenant mismatch
  });

  test('deve processar callback de conclusão', async ({ page }) => {
    const tenantId = await createTenant('Test Tenant');
    const jobId = await createJob(tenantId, 'translating');
    
    // Simular callback de conclusão
    const response = await page.evaluate(async ({ jobId, tenantId }) => {
      return fetch('/api/webhooks/job-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          tenant_id: tenantId,
          final_pdf_url: 'https://s3.amazonaws.com/bucket/final.pdf',
          status: 'done'
        })
      }).then(res => ({ status: res.status, ok: res.ok }));
    }, { jobId, tenantId });
    
    expect(response.ok).toBe(true);
    
    // Verificar que job foi marcado como concluído
    const job = await page.evaluate(async (jobId) => {
      const res = await fetch(`/api/jobs/${jobId}`);
      return res.json();
    }, jobId);
    
    expect(job.status).toBe('done');
    expect(job.final_pdf_url).toBe('https://s3.amazonaws.com/bucket/final.pdf');
  });
});
```

---

## FASE 6: Testes de Review Gates

### 6.1 Teste de Interface de Revisão
```typescript
// tests/e2e/review/interface.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsOperator, createJobInReview } from '../../helpers/auth';

test.describe('Interface de Revisão', () => {
  let jobId: string;
  let sessionId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
    const reviewData = await createJobInReview();
    jobId = reviewData.jobId;
    sessionId = reviewData.sessionId;
  });

  test('deve exibir PDF e formulário split-screen', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Verificar layout split-screen
    await expect(page.locator('[data-testid="pdf-viewer"]')).toBeVisible();
    await expect(page.locator('[data-testid="keys-form"]')).toBeVisible();
    
    // Verificar que PDF carregou
    const pdfFrame = page.frameLocator('[data-testid="pdf-viewer"] iframe');
    await expect(pdfFrame.locator('canvas')).toBeVisible();
    
    // Verificar campos do formulário
    await expect(page.locator('[data-testid="field-cpf"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-nome"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-endereco"]')).toBeVisible();
    
    // Verificar valores pré-preenchidos
    await expect(page.locator('[data-testid="field-cpf"]')).toHaveValue('123.456.789-00');
    await expect(page.locator('[data-testid="field-nome"]')).toHaveValue('João Silva');
  });

  test('deve permitir navegação no PDF', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Verificar controles de navegação
    await expect(page.locator('[data-testid="pdf-prev-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="pdf-next-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="pdf-page-info"]')).toContainText('1 / 3');
    
    // Navegar para próxima página
    await page.click('[data-testid="pdf-next-page"]');
    await expect(page.locator('[data-testid="pdf-page-info"]')).toContainText('2 / 3');
    
    // Testar zoom
    await page.click('[data-testid="pdf-zoom-in"]');
    await page.click('[data-testid="pdf-zoom-in"]');
    
    // Verificar que zoom aumentou (verificar através do CSS transform ou similar)
    const zoomLevel = await page.locator('[data-testid="pdf-zoom-level"]').textContent();
    expect(zoomLevel).toBe('150%');
  });

  test('deve ser responsivo em diferentes tamanhos de tela', async ({ page }) => {
    // Testar em desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Verificar layout lado a lado
    const pdfViewer = page.locator('[data-testid="pdf-viewer"]');
    const keysForm = page.locator('[data-testid="keys-form"]');
    
    const pdfBox = await pdfViewer.boundingBox();
    const formBox = await keysForm.boundingBox();
    
    expect(pdfBox?.width).toBeGreaterThan(400);
    expect(formBox?.width).toBeGreaterThan(400);
    
    // Testar em tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    // Verificar que layout se adapta (pode ser stack vertical)
    await expect(pdfViewer).toBeVisible();
    await expect(keysForm).toBeVisible();
    
    // Testar em mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Verificar que ainda funciona em mobile
    await expect(pdfViewer).toBeVisible();
    await expect(keysForm).toBeVisible();
  });
});
```

### 6.2 Teste de Edição e Aprovação
```typescript
// tests/e2e/review/approval.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsOperator, createJobInReview } from '../../helpers/auth';

test.describe('Edição e Aprovação de Chaves', () => {
  let jobId: string;
  let sessionId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
    const reviewData = await createJobInReview({
      keysData: {
        cpf: { value: '123.456.789-00', source_agent_id: 'agent-cpf' },
        nome: { value: 'João Silva', source_agent_id: 'agent-nome' },
        endereco: { value: '', source_agent_id: 'agent-endereco' } // Campo vazio
      },
      requiredFields: ['cpf', 'endereco'] // Endereço é obrigatório
    });
    jobId = reviewData.jobId;
    sessionId = reviewData.sessionId;
  });

  test('deve editar valores de chaves existentes', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Editar CPF
    await page.fill('[data-testid="field-cpf"]', '987.654.321-00');
    
    // Editar nome
    await page.fill('[data-testid="field-nome"]', 'Maria Santos');
    
    // Verificar que mudanças são detectadas
    await expect(page.locator('[data-testid="unsaved-changes"]')).toBeVisible();
    
    // Salvar mudanças temporariamente
    await page.click('[data-testid="save-draft"]');
    
    await expect(page.locator('text=Rascunho salvo')).toBeVisible();
    
    // Recarregar página e verificar que mudanças persistiram
    await page.reload();
    await expect(page.locator('[data-testid="field-cpf"]')).toHaveValue('987.654.321-00');
    await expect(page.locator('[data-testid="field-nome"]')).toHaveValue('Maria Santos');
  });

  test('deve adicionar nova chave não extraída', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Adicionar nova chave
    await page.click('[data-testid="add-new-key"]');
    
    // Preencher modal de nova chave
    await page.fill('[data-testid="new-key-name"]', 'telefone');
    await page.fill('[data-testid="new-key-value"]', '(11) 99999-9999');
    await page.click('[data-testid="save-new-key"]');
    
    // Verificar que nova chave apareceu no formulário
    await expect(page.locator('[data-testid="field-telefone"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-telefone"]')).toHaveValue('(11) 99999-9999');
    
    // Verificar que é marcada como adicionada manualmente
    await expect(page.locator('[data-testid="manual-key-telefone"]')).toBeVisible();
  });

  test('deve bloquear aprovação com campos obrigatórios vazios', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Tentar aprovar com endereço vazio (obrigatório)
    await page.click('[data-testid="approve-review"]');
    
    // Verificar erro de validação
    await expect(page.locator('text=Campo obrigatório: endereco')).toBeVisible();
    await expect(page.locator('[data-testid="field-endereco"]')).toHaveClass(/error/);
    
    // Preencher campo obrigatório
    await page.fill('[data-testid="field-endereco"]', 'Rua das Flores, 123');
    
    // Tentar aprovar novamente
    await page.click('[data-testid="approve-review"]');
    
    // Verificar que aprovação foi bem-sucedida
    await expect(page.locator('text=Revisão aprovada com sucesso')).toBeVisible();
    
    // Verificar redirecionamento para lista de jobs
    await expect(page).toHaveURL('/jobs');
  });

  test('deve registrar histórico de mudanças', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Fazer várias mudanças
    await page.fill('[data-testid="field-cpf"]', '111.222.333-44');
    await page.fill('[data-testid="field-nome"]', 'Pedro Oliveira');
    await page.fill('[data-testid="field-endereco"]', 'Av. Paulista, 1000');
    
    // Adicionar nova chave
    await page.click('[data-testid="add-new-key"]');
    await page.fill('[data-testid="new-key-name"]', 'email');
    await page.fill('[data-testid="new-key-value"]', 'pedro@email.com');
    await page.click('[data-testid="save-new-key"]');
    
    // Aprovar revisão
    await page.click('[data-testid="approve-review"]');
    
    // Verificar que histórico foi registrado
    const auditLog = await page.evaluate(async (sessionId) => {
      const res = await fetch(`/api/review-sessions/${sessionId}/audit`);
      return res.json();
    }, sessionId);
    
    expect(auditLog).toHaveLength(4); // 3 edições + 1 adição
    
    // Verificar detalhes do log
    const cpfChange = auditLog.find(log => log.key_name === 'cpf');
    expect(cpfChange.old_value).toBe('123.456.789-00');
    expect(cpfChange.new_value).toBe('111.222.333-44');
    expect(cpfChange.source_agent_id).toBe('agent-cpf');
    
    const emailAddition = auditLog.find(log => log.key_name === 'email');
    expect(emailAddition.old_value).toBeNull();
    expect(emailAddition.new_value).toBe('pedro@email.com');
    expect(emailAddition.source_agent_id).toBeNull(); // Adicionado manualmente
  });

  test('deve permitir rejeição com comentários', async ({ page }) => {
    await page.goto(`/jobs/${jobId}/review/${sessionId}`);
    
    // Rejeitar revisão
    await page.click('[data-testid="reject-review"]');
    
    // Verificar modal de rejeição
    await expect(page.locator('[data-testid="reject-modal"]')).toBeVisible();
    
    // Preencher motivo da rejeição
    await page.fill('[data-testid="rejection-reason"]', 'Dados inconsistentes com o documento');
    await page.click('[data-testid="confirm-rejection"]');
    
    // Verificar que job voltou para processamento
    await expect(page.locator('text=Revisão rejeitada')).toBeVisible();
    
    // Verificar estado do job
    const job = await page.evaluate(async (jobId) => {
      const res = await fetch(`/api/jobs/${jobId}`);
      return res.json();
    }, jobId);
    
    expect(job.status).toBe('processing'); // Volta para reprocessamento
  });
});
```

---

## FASE 7: Testes de Clonagem

### 7.1 Teste de Clonagem de Workflows
```typescript
// tests/e2e/tenant-admin/cloning.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTenantAdmin, createGlobalWorkflow } from '../../helpers/auth';

test.describe('Clonagem de Workflows', () => {
  let globalWorkflowId: string;

  test.beforeEach(async ({ page }) => {
    globalWorkflowId = await createGlobalWorkflow();
    await loginAsTenantAdmin(page);
  });

  test('deve clonar workflow global para tenant', async ({ page }) => {
    await page.goto('/tenant/workflows');
    
    // Verificar que workflows globais estão disponíveis
    await expect(page.locator('[data-testid="global-workflows"]')).toBeVisible();
    await expect(page.locator(`[data-testid="global-workflow-${globalWorkflowId}"]`)).toBeVisible();
    
    // Clonar workflow
    await page.click(`[data-testid="clone-workflow-${globalWorkflowId}"]`);
    
    // Verificar modal de clonagem
    await expect(page.locator('[data-testid="clone-modal"]')).toBeVisible();
    
    // Preencher nome do clone
    await page.fill('[data-testid="clone-name"]', 'Workflow Personalizado');
    await page.fill('[data-testid="clone-description"]', 'Versão customizada para nosso tenant');
    
    await page.click('[data-testid="confirm-clone"]');
    
    // Verificar que clone foi criado
    await expect(page.locator('text=Workflow clonado com sucesso')).toBeVisible();
    
    // Verificar que aparece na lista de workflows do tenant
    await expect(page.locator('[data-testid="tenant-workflows"]')).toContainText('Workflow Personalizado');
    
    // Verificar que pode ser editado
    await page.click('[data-testid="edit-workflow-Workflow Personalizado"]');
    await expect(page.locator('[data-testid="workflow-builder"]')).toBeVisible();
  });

  test('deve personalizar agentes clonados', async ({ page }) => {
    await page.goto('/tenant/workflows');
    
    // Clonar workflow
    await page.click(`[data-testid="clone-workflow-${globalWorkflowId}"]`);
    await page.fill('[data-testid="clone-name"]', 'Workflow com Agentes Personalizados');
    await page.click('[data-testid="confirm-clone"]');
    
    // Editar workflow clonado
    await page.click('[data-testid="edit-workflow-Workflow com Agentes Personalizados"]');
    
    // Selecionar nó de agente
    await page.click('[data-testid="node-agent-1"]');
    
    // Verificar que pode personalizar prompt
    await expect(page.locator('[data-testid="customize-agent"]')).toBeVisible();
    await page.click('[data-testid="customize-agent"]');
    
    // Modificar system prompt
    await page.fill('[data-testid="custom-system-prompt"]', 
      'Extract text with focus on Brazilian documents and Portuguese language');
    
    // Modificar modelo
    await page.selectOption('[data-testid="custom-model"]', 'gpt-4-turbo');
    
    await page.click('[data-testid="save-agent-customization"]');
    
    // Salvar workflow
    await page.click('[data-testid="save-workflow"]');
    
    // Verificar que customizações foram salvas
    await page.click('[data-testid="node-agent-1"]');
    await expect(page.locator('[data-testid="agent-customized-indicator"]')).toBeVisible();
  });

  test('deve manter versionamento de clones', async ({ page }) => {
    await page.goto('/tenant/workflows');
    
    // Clonar workflow
    await page.click(`[data-testid="clone-workflow-${globalWorkflowId}"]`);
    await page.fill('[data-testid="clone-name"]', 'Workflow Versionado');
    await page.click('[data-testid="confirm-clone"]');
    
    // Verificar informações de versionamento
    await page.click('[data-testid="workflow-info-Workflow Versionado"]');
    
    const versionInfo = await page.locator('[data-testid="version-info"]').textContent();
    expect(versionInfo).toContain('Clonado de: Workflow Global');
    expect(versionInfo).toContain('Versão original: 1.0');
    
    // Verificar que mudanças no original não afetam o clone
    // (isso seria testado em integração com o sistema de versionamento)
  });
});
```

### 7.2 Teste de Clonagem de Agentes
```typescript
// tests/e2e/tenant-admin/agent-cloning.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTenantAdmin, createGlobalAgent } from '../../helpers/auth';

test.describe('Clonagem de Agentes', () => {
  let globalAgentId: string;

  test.beforeEach(async ({ page }) => {
    globalAgentId = await createGlobalAgent({
      name: 'OCR Global',
      type: 'ocr',
      system_prompt: 'Extract all text from image',
      model: 'gpt-4-vision'
    });
    await loginAsTenantAdmin(page);
  });

  test('deve clonar agente global com customizações', async ({ page }) => {
    await page.goto('/tenant/agents');
    
    // Verificar agentes globais disponíveis
    await expect(page.locator('[data-testid="global-agents"]')).toBeVisible();
    await expect(page.locator(`[data-testid="global-agent-${globalAgentId}"]`)).toBeVisible();
    
    // Clonar agente
    await page.click(`[data-testid="clone-agent-${globalAgentId}"]`);
    
    // Preencher customizações
    await page.fill('[data-testid="clone-name"]', 'OCR Personalizado');
    await page.fill('[data-testid="custom-system-prompt"]', 
      'Extract text from Brazilian documents, focus on CPF and RG numbers');
    await page.selectOption('[data-testid="custom-model"]', 'gpt-4-turbo');
    
    await page.click('[data-testid="save-clone"]');
    
    // Verificar que clone foi criado
    await expect(page.locator('text=OCR Personalizado')).toBeVisible();
    
    // Verificar que mantém referência ao original
    await page.click('[data-testid="agent-info-OCR Personalizado"]');
    const info = await page.locator('[data-testid="agent-origin"]').textContent();
    expect(info).toContain('Baseado em: OCR Global');
  });

  test('deve permitir apenas customizações permitidas por tipo', async ({ page }) => {
    await page.goto('/tenant/agents');
    
    await page.click(`[data-testid="clone-agent-${globalAgentId}"]`);
    
    // Para agente OCR, deve permitir customizar:
    await expect(page.locator('[data-testid="custom-system-prompt"]')).toBeVisible();
    await expect(page.locator('[data-testid="custom-model"]')).toBeVisible();
    
    // Mas não deve permitir mudar tipo ou webhook_url
    await expect(page.locator('[data-testid="custom-type"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="custom-webhook-url"]')).not.toBeVisible();
  });
});
```

---

## FASE 8: Testes E2E Completos

### 8.1 Teste de Fluxo Completo
```typescript
// tests/e2e/integration/complete-flow.spec.ts
import { test, expect } from '@playwright/test';
import { 
  loginAsSuperAdmin, 
  loginAsTenantAdmin, 
  loginAsOperator,
  createTenant 
} from '../../helpers/auth';
import { uploadTestPDF } from '../../helpers/files';

test.describe('Fluxo Completo E2E', () => {
  let tenantId: string;
  let workflowId: string;

  test('deve executar fluxo completo do sistema', async ({ browser }) => {
    // Criar contextos separados para diferentes usuários
    const superAdminContext = await browser.newContext();
    const tenantAdminContext = await browser.newContext();
    const operatorContext = await browser.newContext();
    
    const superAdminPage = await superAdminContext.newPage();
    const tenantAdminPage = await tenantAdminContext.newPage();
    const operatorPage = await operatorContext.newPage();

    try {
      // ETAPA 1: Super-Admin cria agentes e workflow
      await loginAsSuperAdmin(superAdminPage);
      
      // Criar agente OCR
      await superAdminPage.goto('/super-admin/agents');
      await superAdminPage.click('[data-testid="create-agent"]');
      await superAdminPage.fill('[data-testid="agent-name"]', 'OCR E2E Test');
      await superAdminPage.selectOption('[data-testid="agent-type"]', 'ocr');
      await superAdminPage.fill('[data-testid="webhook-url"]', 'https://api.test.com/ocr');
      await superAdminPage.fill('[data-testid="system-prompt"]', 'Extract all text');
      await superAdminPage.click('[data-testid="save-agent"]');
      
      // Criar agente extrator
      await superAdminPage.click('[data-testid="create-agent"]');
      await superAdminPage.fill('[data-testid="agent-name"]', 'Extrator CPF E2E');
      await superAdminPage.selectOption('[data-testid="agent-type"]', 'extract_structured');
      await superAdminPage.click('[data-testid="add-responsible-key"]');
      await superAdminPage.fill('[data-testid="responsible-key-0"]', 'cpf');
      await superAdminPage.fill('[data-testid="system-prompt"]', 'Extract CPF');
      await superAdminPage.click('[data-testid="save-agent"]');
      
      // Criar workflow
      await superAdminPage.goto('/super-admin/workflows/builder');
      await superAdminPage.click('[data-testid="new-workflow"]');
      await superAdminPage.fill('[data-testid="workflow-name"]', 'Workflow E2E Test');
      
      // Montar workflow visualmente
      await superAdminPage.dragAndDrop(
        '[data-testid="node-palette-agent"]',
        '[data-testid="workflow-canvas"]'
      );
      await superAdminPage.click('[data-testid="node-agent-1"]');
      await superAdminPage.selectOption('[data-testid="select-agent"]', 'OCR E2E Test');
      await superAdminPage.click('[data-testid="save-node-config"]');
      
      await superAdminPage.dragAndDrop(
        '[data-testid="node-palette-group"]',
        '[data-testid="workflow-canvas"]'
      );
      await superAdminPage.click('[data-testid="node-group-1"]');
      await superAdminPage.click('[data-testid="add-agent-to-group"]');
      await superAdminPage.selectOption('[data-testid="group-agent-0"]', 'Extrator CPF E2E');
      await superAdminPage.click('[data-testid="save-node-config"]');
      
      // Conectar nós
      await superAdminPage.dragAndDrop(
        '[data-testid="output-handle-agent-1"]',
        '[data-testid="input-handle-group-1"]'
      );
      
      await superAdminPage.click('[data-testid="save-workflow"]');
      
      // ETAPA 2: Tenant Admin clona e personaliza
      tenantId = await createTenant('E2E Test Tenant');
      await loginAsTenantAdmin(tenantAdminPage, tenantId);
      
      await tenantAdminPage.goto('/tenant/workflows');
      await tenantAdminPage.click('[data-testid="clone-workflow-Workflow E2E Test"]');
      await tenantAdminPage.fill('[data-testid="clone-name"]', 'Workflow Personalizado E2E');
      await tenantAdminPage.click('[data-testid="confirm-clone"]');
      
      // Personalizar agente
      await tenantAdminPage.click('[data-testid="edit-workflow-Workflow Personalizado E2E"]');
      await tenantAdminPage.click('[data-testid="node-group-1"]');
      await tenantAdminPage.click('[data-testid="customize-agent-0"]');
      await tenantAdminPage.fill('[data-testid="custom-system-prompt"]', 
        'Extract CPF from Brazilian documents');
      await tenantAdminPage.click('[data-testid="save-agent-customization"]');
      await tenantAdminPage.click('[data-testid="save-workflow"]');
      
      // Configurar token LLM
      await tenantAdminPage.goto('/tenant/settings');
      await tenantAdminPage.fill('[data-testid="llm-token"]', 'sk-test-token-e2e');
      await tenantAdminPage.click('[data-testid="save-settings"]');
      
      // ETAPA 3: Operador executa job
      await loginAsOperator(operatorPage, tenantId);
      
      await operatorPage.goto('/jobs');
      await operatorPage.selectOption('[data-testid="workflow-select"]', 'Workflow Personalizado E2E');
      
      const fileInput = operatorPage.locator('[data-testid="pdf-upload"]');
      await fileInput.setInputFiles(await uploadTestPDF());
      
      await operatorPage.click('[data-testid="start-job"]');
      
      // Verificar que job foi criado
      await expect(operatorPage.locator('text=Job iniciado com sucesso')).toBeVisible();
      
      // Simular processamento e review gate
      const jobId = await operatorPage.evaluate(() => {
        const jobRows = document.querySelectorAll('[data-testid="job-row"]');
        return jobRows[0]?.getAttribute('data-job-id');
      });
      
      // Simular callback do n8n
      await operatorPage.evaluate(async (data) => {
        await fetch('/api/webhooks/review-gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: data.jobId,
            tenant_id: data.tenantId,
            gate_id: 'gate-1',
            keys_data: {
              cpf: { value: '123.456.789-00', source_agent_id: 'agent-cpf' }
            },
            status: 'review:gate-1'
          })
        });
      }, { jobId, tenantId });
      
      // Recarregar e verificar que job está em revisão
      await operatorPage.reload();
      const jobRow = operatorPage.locator(`[data-job-id="${jobId}"]`);
      await expect(jobRow.locator('[data-testid="job-status"]')).toContainText('review');
      
      // Abrir tela de revisão
      await jobRow.locator('[data-testid="review-job"]').click();
      
      // Verificar interface de revisão
      await expect(operatorPage.locator('[data-testid="pdf-viewer"]')).toBeVisible();
      await expect(operatorPage.locator('[data-testid="keys-form"]')).toBeVisible();
      await expect(operatorPage.locator('[data-testid="field-cpf"]')).toHaveValue('123.456.789-00');
      
      // Aprovar revisão
      await operatorPage.click('[data-testid="approve-review"]');
      
      await expect(operatorPage.locator('text=Revisão aprovada com sucesso')).toBeVisible();
      
      // Verificar que voltou para lista de jobs
      await expect(operatorPage).toHaveURL('/jobs');
      
      // Simular conclusão do job
      await operatorPage.evaluate(async (data) => {
        await fetch('/api/webhooks/job-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: data.jobId,
            tenant_id: data.tenantId,
            final_pdf_url: 'https://s3.amazonaws.com/bucket/final.pdf',
            status: 'done'
          })
        });
      }, { jobId, tenantId });
      
      // Verificar que job foi concluído
      await operatorPage.reload();
      await expect(jobRow.locator('[data-testid="job-status"]')).toContainText('done');
      
      // Verificar que pode baixar resultado
      await expect(jobRow.locator('[data-testid="download-result"]')).toBeVisible();
      
    } finally {
      // Cleanup
      await superAdminContext.close();
      await tenantAdminContext.close();
      await operatorContext.close();
    }
  });
});
```

### 8.2 Teste de Performance
```typescript
// tests/e2e/performance/load-test.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsOperator, createWorkflowWithToken } from '../../helpers/auth';

test.describe('Testes de Performance', () => {
  test('deve suportar múltiplos jobs simultâneos', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    
    // Criar 5 contextos simultâneos
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
      
      await loginAsOperator(page);
    }
    
    const workflowId = await createWorkflowWithToken();
    
    try {
      // Iniciar jobs simultaneamente
      const jobPromises = pages.map(async (page, index) => {
        await page.goto('/jobs');
        await page.selectOption('[data-testid="workflow-select"]', workflowId);
        
        const fileInput = page.locator('[data-testid="pdf-upload"]');
        await fileInput.setInputFiles(await uploadTestPDF());
        
        const startTime = Date.now();
        await page.click('[data-testid="start-job"]');
        
        await expect(page.locator('text=Job iniciado com sucesso')).toBeVisible();
        const endTime = Date.now();
        
        return {
          index,
          duration: endTime - startTime
        };
      });
      
      const results = await Promise.all(jobPromises);
      
      // Verificar que todos os jobs foram criados em tempo aceitável
      results.forEach(result => {
        expect(result.duration).toBeLessThan(5000); // Menos de 5 segundos
      });
      
      // Verificar que não houve conflitos de concorrência
      const jobCounts = await Promise.all(
        pages.map(page => 
          page.evaluate(() => 
            document.querySelectorAll('[data-testid="job-row"]').length
          )
        )
      );
      
      // Cada usuário deve ver pelo menos 1 job (o seu próprio)
      jobCounts.forEach(count => {
        expect(count).toBeGreaterThanOrEqual(1);
      });
      
    } finally {
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('deve carregar interface rapidamente', async ({ page }) => {
    await loginAsOperator(page);
    
    // Medir tempo de carregamento da página de jobs
    const startTime = Date.now();
    await page.goto('/jobs');
    await expect(page.locator('[data-testid="jobs-list"]')).toBeVisible();
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Menos de 3 segundos
    
    // Verificar métricas de performance
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      };
    });
    
    expect(metrics.domContentLoaded).toBeLessThan(2000);
    expect(metrics.firstPaint).toBeLessThan(1500);
  });
});
```

---

## Configuração de Helpers

### Helpers de Autenticação
```typescript
// tests/helpers/auth.ts
import { Page } from '@playwright/test';

export async function loginAsSuperAdmin(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('test_user', JSON.stringify({
      id: 'super-admin-1',
      email: 'super@admin.com',
      role: 'super_admin',
      tenant_id: null
    }));
  });
  await page.goto('/super-admin');
}

export async function loginAsTenantAdmin(page: Page, tenantId?: string) {
  await page.goto('/login');
  await page.evaluate((tid) => {
    localStorage.setItem('test_user', JSON.stringify({
      id: 'tenant-admin-1',
      email: 'admin@tenant.com',
      role: 'tenant_admin',
      tenant_id: tid || 'tenant-1'
    }));
  }, tenantId);
  await page.goto('/tenant');
}

export async function loginAsOperator(page: Page, tenantId?: string) {
  await page.goto('/login');
  await page.evaluate((tid) => {
    localStorage.setItem('test_user', JSON.stringify({
      id: 'operator-1',
      email: 'operator@tenant.com',
      role: 'operator',
      tenant_id: tid || 'tenant-1'
    }));
  }, tenantId);
  await page.goto('/jobs');
}
```

---

## Execução dos Testes

### Scripts de Execução
```json
// package.json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report",
    "test:e2e:fase1": "playwright test tests/e2e/database/",
    "test:e2e:fase2": "playwright test tests/e2e/auth/",
    "test:e2e:fase3": "playwright test tests/e2e/super-admin/",
    "test:e2e:fase4": "playwright test tests/e2e/workflows/",
    "test:e2e:fase5": "playwright test tests/e2e/jobs/",
    "test:e2e:fase6": "playwright test tests/e2e/review/",
    "test:e2e:fase7": "playwright test tests/e2e/tenant-admin/",
    "test:e2e:fase8": "playwright test tests/e2e/integration/"
  }
}
```

### CI/CD Integration
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install
      - name: Run E2E tests
        run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Checklist de Validação por Fase

### ✅ Checklist Geral de Testes
- [ ] Todos os testes passam sem falhas
- [ ] Cobertura de testes > 80% nas funcionalidades críticas
- [ ] Testes de performance dentro dos SLAs definidos
- [ ] Testes de segurança (RLS, autenticação) validados
- [ ] Testes de integração com n8n funcionando
- [ ] Testes de responsividade em diferentes dispositivos
- [ ] Testes de acessibilidade básica implementados
- [ ] Documentação de testes atualizada
- [ ] CI/CD configurado para execução automática
- [ ] Relatórios de teste gerados e acessíveis

Este documento fornece uma base sólida para validação de cada fase do desenvolvimento, garantindo que todas as funcionalidades sejam testadas de forma abrangente e automatizada.