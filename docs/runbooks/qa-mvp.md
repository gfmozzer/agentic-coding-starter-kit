# QA Checklist � MVP Translator

## Pr�-requisitos
- Banco de dados com migra��es atualizadas (`pnpm db:migrate`).
- Vari�veis `.env` configuradas (tokens n8n, S3, OPENAI_MODEL, etc.).
- Storage acess�vel para upload/render (`S3_BUCKET`).
- Usu�rios:
  - Super-admin ativo.
  - Operador em tenant com workflows disponibilizados.

## Checklist Funcional

### 1. Workflow completo (builder)
- [ ] Logar como super-admin e abrir `/super-admin/workflows`.
- [ ] Criar template com sequ�ncia **OCR ? grupo extratores ? review grupo ? tradutor ? review tradutor ? render**.
- [ ] Publicar workflow para o tenant alvo em `/super-admin/workflow-library`.

### 2. Clone e personaliza��o pelo operador
- [ ] Logar como operador e acessar `/operator/workflows`.
- [ ] Clonar workflow publicado e ajustar prompts/HTML sem alterar ordem dos steps.
- [ ] Confirmar que clone aparece listado com tipo `tenant`.

### 3. In�cio de job (upload)
- [ ] Em `/operator/start-translation`, iniciar job com workflow clonado.
- [ ] Validar disparo para n8n (`job_events` deve registrar `job_started` / atualiza��es iniciais).
- [ ] Conferir status em `/jobs` movendo de `queued` ? `processing`.

### 4. Review gate de grupo
- [ ] Receber webhook n8n com `input_kind: group`.
- [ ] Verificar entrada em `/reviews` com preview das p�ginas.
- [ ] Abrir detalhe, editar ao menos uma chave e submeter.
- [ ] Checar `key_audit` e evento `review_approved`.

### 5. Review do tradutor e render final
- [ ] Confirmar segundo gate (`gate_id` configurado no tradutor) dispon�vel e repetir processo de aprova��o.
- [ ] Ap�s aprova��o final, validar evento `job_completed` com `finalPdfUrl`.
- [ ] Em `/jobs/[jobId]`, baixar PDF via link assinado do S3.

### 6. RLS e seguran�a
- [ ] Tentar acessar job/gate de outro tenant ? espera `403`/redirect.
- [ ] Validar p�ginas administrativas n�o acess�veis a operadores e vice-versa.

## Observa��es
- Registrar logs relevantes (`job_events`) e capturas de tela para anexar ao relat�rio.
- Se alguma etapa falhar, abrir issue e anexar payloads (webhook, job) para debugging.

