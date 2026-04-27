/**
 * Gold-set evaluator. Run against a live backend:
 *   npx tsx eval/run.ts http://localhost:8787
 */

import cases from "./gold-set/cases.json" with { type: "json" };

type Case = {
  id: string;
  text: string;
  quiz?: Record<string, unknown>;
  expected_mode?: string;
  expected_top_concern?: string;
  expected_primary_slug?: string;
  expected_bundle?: string;
  assert_no_slug?: string;
  assert_sensitive_filter?: boolean;
  assert_high_pigmentation_risk?: boolean;
  assert_instagram_consultation?: boolean;
  assert_no_supporting?: boolean;
  assert_matcha_upsell?: boolean;
  assert_skin_type?: string;
  assert_secondary_bundle?: string;
  assert_no_secondary_bundle?: boolean;
};

const base = process.argv[2] ?? "http://localhost:8787";

async function runOne(c: Case): Promise<{ id: string; ok: boolean; detail: string }> {
  const fd = new FormData();
  fd.append("text", c.text);
  if (c.quiz) fd.append("quiz", JSON.stringify(c.quiz));

  const res = await fetch(`${base}/api/advise`, { method: "POST", body: fd });
  if (!res.ok) return { id: c.id, ok: false, detail: `HTTP ${res.status}` };
  const data: any = await res.json();

  const failures: string[] = [];
  const r = data.response ?? {};
  const profile = data.profile ?? {};
  const topConcern = data.classification?.concerns?.[0]?.label;
  const primarySlug = r.primary_product?.slug;
  const bundleSlug = r.bundle?.slug;
  const allSlugs = JSON.stringify(r);

  if (c.expected_mode && data.mode !== c.expected_mode)
    failures.push(`mode=${data.mode} (want ${c.expected_mode})`);
  if (c.expected_top_concern && topConcern !== c.expected_top_concern)
    failures.push(`top=${topConcern} (want ${c.expected_top_concern})`);
  if (c.expected_primary_slug && primarySlug !== c.expected_primary_slug)
    failures.push(`primary=${primarySlug} (want ${c.expected_primary_slug})`);
  if (c.expected_bundle && bundleSlug !== c.expected_bundle)
    failures.push(`bundle=${bundleSlug} (want ${c.expected_bundle})`);
  if (c.assert_no_slug && allSlugs.includes(c.assert_no_slug))
    failures.push(`should NOT contain ${c.assert_no_slug}`);
  if (c.assert_sensitive_filter && !profile.sensitive_filter_active)
    failures.push("sensitive_filter expected true");
  if (c.assert_high_pigmentation_risk && !profile.high_pigmentation_risk)
    failures.push("high_pigmentation_risk expected true");
  if (c.assert_instagram_consultation && !r.instagram_consultation)
    failures.push("instagram_consultation expected true");
  if (c.assert_no_supporting && Array.isArray(r.supporting_products) && r.supporting_products.length > 0)
    failures.push(`expected no supporting products, got ${r.supporting_products.length}`);
  if (c.assert_matcha_upsell && (!r.double_cleanse_upsell || r.double_cleanse_upsell.code !== "MATCHA15"))
    failures.push("MATCHA15 upsell expected");
  if (c.assert_skin_type && profile.skin_type !== c.assert_skin_type)
    failures.push(`skin_type=${profile.skin_type} (want ${c.assert_skin_type})`);

  const secondaryBundleSlug = r.secondary_bundle?.slug;
  if (c.assert_secondary_bundle && secondaryBundleSlug !== c.assert_secondary_bundle)
    failures.push(`secondary_bundle=${secondaryBundleSlug ?? "null"} (want ${c.assert_secondary_bundle})`);
  if (c.assert_no_secondary_bundle && r.secondary_bundle)
    failures.push(`expected no secondary_bundle, got ${secondaryBundleSlug}`);

  const ok = failures.length === 0;
  const detail = ok
    ? `mode=${data.mode} top=${topConcern ?? "—"} primary=${primarySlug ?? "—"} bundle=${bundleSlug ?? "—"}`
    : failures.join("; ");
  return { id: c.id, ok, detail };
}

async function main() {
  console.log(`Running ${cases.length} cases against ${base}`);
  let pass = 0;
  for (const c of cases as Case[]) {
    const r = await runOne(c);
    if (r.ok) pass++;
    console.log(`${r.ok ? "✓" : "✗"} [${c.id}] ${r.detail}`);
  }
  const pct = ((pass / cases.length) * 100).toFixed(1);
  console.log(`\n${pass}/${cases.length} passing (${pct}%)`);
  if (pass < cases.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
