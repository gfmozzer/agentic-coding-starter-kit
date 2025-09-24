import assert from "node:assert/strict";
import { test } from "node:test";

import type { WorkflowStep } from "../../src/lib/workflows/types";

function buildExampleSteps(): WorkflowStep[] {
  return [
    {
      id: "a_ocr",
      type: "agent",
      order: 1,
      label: null,
      agentId: "agt_ocr",
      config: {},
    },
    {
      id: "g_ex",
      type: "group",
      order: 2,
      label: null,
      inputFrom: "a_ocr",
      members: [
        { agentId: "agt_selos", order: 1 },
        { agentId: "agt_texto", order: 2 },
      ],
      config: {},
    },
    {
      id: "rv_ex",
      type: "review_gate",
      order: 3,
      label: "Revisar extração",
      gateKey: "rv_ex",
      sourceStepId: "g_ex",
      sourceKind: "group",
      title: "Review extração",
      instructions: "Verifique todas as chaves estruturadas",
      config: {},
    },
    {
      id: "a_trad",
      type: "translator",
      order: 4,
      label: null,
      translatorAgentId: "agt_trad_it",
      sourceStepId: "rv_ex",
      config: { targetLang: "it" },
    },
    {
      id: "rv_tr",
      type: "review_gate",
      order: 5,
      label: "Review tradução",
      gateKey: "rv_tr",
      sourceStepId: "a_trad",
      sourceKind: "agent",
      title: "Ajustar tradução",
      instructions: "Confirme nome próprio",
      config: {},
    },
    {
      id: "rend",
      type: "render",
      order: 6,
      label: null,
      sourceStepId: "rv_tr",
      templateId: "tpl_certidao",
      config: { templateId: "tpl_certidao" },
    },
  ];
}

test("buildExampleSteps cria estrutura válida", () => {
  const steps = buildExampleSteps();
  assert.equal(steps.length, 6);
  assert.equal(steps[0].id, "a_ocr");
  assert.equal(steps[steps.length - 1].id, "rend");
  
  // Verifica se os steps estão em ordem
  steps.forEach((step: WorkflowStep, index: number) => {
    assert.equal(step.order, index + 1);
  });
});

test("workflow tem passo render obrigatório", () => {
  const steps = buildExampleSteps();
  const renderSteps = steps.filter((step) => step.type === "render");
  assert.equal(renderSteps.length, 1, "Deve ter exatamente um passo render");
});

test("workflow estrutura de grupos válida", () => {
  const steps = buildExampleSteps();
  const groupStep = steps.find((step) => step.type === "group");
  assert.ok(groupStep, "Deve ter pelo menos um grupo");
  
  if (groupStep && groupStep.type === "group") {
    assert.ok(groupStep.members.length > 0, "Grupo deve ter membros");
    assert.ok(groupStep.inputFrom, "Grupo deve ter inputFrom");
  }
});