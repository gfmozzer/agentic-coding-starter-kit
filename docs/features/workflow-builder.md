# Workflow Builder (Super-Admin)

## Vis�o Geral
- Permite ao super-admin montar workflows compostos por agentes, grupos de extratores e review gates.
- Builder garante ordem r�gida (OCR ? grupos ? reviews ? tradutor ? render) conforme requisitos do MVP.
- UI exposta em `/super-admin/workflows` com cliente React (`workflows-client.tsx`) e API utilizando Drizzle + Better Auth.

## Fluxo Principal
1. **Listagem**: lista workflows globais usando `src/lib/workflows/builder.ts` e tabela `workflow_templates`.
2. **Edi��o/Cria��o**: formul�rio controla nodes (`agents`, `groups`, `reviewGates`) com valida��o via Zod e persist�ncia em `src/lib/workflows/tenant.ts`.
3. **Publica��o**: super-admin disponibiliza workflow para tenants em `/super-admin/workflow-library` (consulta `tenant_workflow_publishings`).
4. **Clone pelo Operador**: operadores derivam c�pias em `/operator/workflows` respeitando ordem original; prompts/HTML podem ser ajustados, ordem n�o.

## Principais Arquivos
- `src/app/(super-admin)/super-admin/workflows/workflows-client.tsx` � componente client-side com drag-and-drop, cards de etapa e valida��o.
- `src/lib/workflows/builder.ts` � fun��es para criar/atualizar templates e estruturar dados (inclui `serializeWorkflowGraph`).
- `src/lib/db/schema/workflows.ts` � schema Drizzle para `workflow_templates`, `workflow_nodes`, `workflow_edges`.
- `src/lib/workflows/tenant.ts` � l�gica para clonar workflow global para tenant e sincronizar prompts/HTML.

## Dados e Regras
- Cada node possui `id`, `kind` (`agent`, `group`, `review`, `renderer`), metadados e ordem garantida pelos edges direcionais.
- Review gates no builder definem `input_kind` (`agent` ou `group`) e `ref_id` usado pelo n8n e UI do operador.
- Tabelas chave:
  - `workflow_templates`, `workflow_nodes`, `workflow_edges` (templates globais).
  - `tenant_workflow_clones`, `tenant_workflow_nodes`, `tenant_workflow_prompts`.
- Builder impede gaps: n�o salva se faltarem etapas obrigat�rias (OCR, tradutor, render).

## Execu��o e Testes
- Rodar lint e unit�rios: `pnpm lint`, `pnpm test:unit`.
- Ap�s editar workflows rodar migrate se schema mudar: `pnpm db:migrate`.
- Documentos relacionados: `docs/features/operator-workflow-clone.md`, `docs/features/n8n-orchestration.md`.

