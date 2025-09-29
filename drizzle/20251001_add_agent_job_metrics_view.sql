CREATE VIEW agent_job_metrics AS
WITH key_sources AS (
  SELECT
    rg.tenant_id,
    rg.job_id,
    kv.value AS agent_id,
    COUNT(*)::integer AS total_keys
  FROM review_gates rg
  CROSS JOIN LATERAL jsonb_each_text(rg.key_sources) AS kv(key, value)
  WHERE kv.value IS NOT NULL AND kv.value <> ''
  GROUP BY rg.tenant_id, rg.job_id, kv.value
),
edited AS (
  SELECT
    tenant_id,
    job_id,
    source_agent_id AS agent_id,
    COUNT(*)::integer AS edited_keys
  FROM key_audit
  WHERE source_agent_id IS NOT NULL AND source_agent_id <> ''
  GROUP BY tenant_id, job_id, source_agent_id
)
SELECT
  ks.tenant_id,
  ks.job_id,
  ks.agent_id,
  ks.total_keys,
  COALESCE(ed.edited_keys, 0) AS edited_keys,
  CASE
    WHEN ks.total_keys = 0 THEN 1::numeric
    ELSE GREATEST(0, 1 - COALESCE(ed.edited_keys, 0)::numeric / NULLIF(ks.total_keys, 0)::numeric)
  END AS accuracy
FROM key_sources ks
LEFT JOIN edited ed
  ON ed.tenant_id = ks.tenant_id
 AND ed.job_id = ks.job_id
 AND ed.agent_id = ks.agent_id
UNION ALL
SELECT
  ed.tenant_id,
  ed.job_id,
  ed.agent_id,
  0 AS total_keys,
  ed.edited_keys,
  0::numeric AS accuracy
FROM edited ed
WHERE NOT EXISTS (
  SELECT 1
  FROM key_sources ks
  WHERE ks.tenant_id = ed.tenant_id
    AND ks.job_id = ed.job_id
    AND ks.agent_id = ed.agent_id
);

--@@UNDO
DROP VIEW IF EXISTS agent_job_metrics;
