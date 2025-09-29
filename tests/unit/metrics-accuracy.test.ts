import assert from "node:assert/strict";
import { test } from "node:test";

process.env.POSTGRES_URL ??= "postgres://user:pass@localhost:5432/test";


const metricsModulePromise = import("../../src/lib/metrics/agent-accuracy");

test("computeAccuracy retorna proporcao correta quando existem edicoes", async () => {
  const { computeAccuracy } = await metricsModulePromise;
  const value = computeAccuracy(10, 2);
  assert.equal(value, 0.8);
});

test("computeAccuracy retorna 1 quando nenhuma chave foi editada", async () => {
  const { computeAccuracy } = await metricsModulePromise;
  const value = computeAccuracy(5, 0);
  assert.equal(value, 1);
});

test("computeAccuracy retorna 0 quando edits ultrapassam total", async () => {
  const { computeAccuracy } = await metricsModulePromise;
  const value = computeAccuracy(4, 6);
  assert.equal(value, 0);
});

test("computeAccuracy trata cenarios sem chaves atribuidas", async () => {
  const { computeAccuracy } = await metricsModulePromise;
  assert.equal(computeAccuracy(0, 0), 1);
  assert.equal(computeAccuracy(0, 3), 0);
});

