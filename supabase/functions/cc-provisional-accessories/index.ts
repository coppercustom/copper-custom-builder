// Employee-only Edge Function. Requires verified Supabase Auth and active cc_staff membership.
// Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and
// Uses existing cc_staff membership; no separate tester account or allowlist.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const origin = "https://coppercustom.com";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin, "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS" }
});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const bearer = req.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return json({ error: "Service unavailable" }, 503);
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await auth.auth.getUser(bearer.slice(7));
  if (authError || !userData.user) return json({ error: "Unauthorized" }, 401);
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: staff, error: staffError } = await db.from("cc_staff").select("user_id").eq("user_id", userData.user.id).eq("active", true).maybeSingle();
  if (staffError) return json({ error: "Staff authorization unavailable" }, 503);
  if (!staff) return json({ error: "Forbidden" }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body.action;
  const category = body.category;
  if (!["manufacturers", "products", "conflicts", "review-history", "submit-review", "review-summary", "supplier-links"].includes(String(action)) ||
      (action !== "supplier-links" && !["optic", "suppressor"].includes(String(category)))) return json({ error: "Unsupported request" }, 400);
  if (action === "supplier-links") {
    const manufacturer = String(body.manufacturer || "").trim().slice(0, 120);
    const model = String(body.model || "").trim().slice(0, 160);
    const upc = String(body.upc || "").replace(/[^0-9]/g, "").slice(0, 14);
    const mpn = String(body.manufacturer_part_number || "").trim().slice(0, 120);
    const caliber = String(body.caliber || "").trim().slice(0, 80);
    if (!manufacturer || !model) return json({ error: "Manufacturer and model required" }, 400);
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const { data: matches, error: matchError } = await db.from("cc_unified_firearms_v2")
      .select("source,source_id,manufacturer,model,upc,manufacturer_part_number,caliber,firearm_type,weapon_class")
      .ilike("manufacturer", manufacturer.replace(/[%_]/g, ""))
      .ilike("model", model.replace(/[%_]/g, ""))
      .order("source").order("source_id").limit(200);
    if (matchError) return json({ error: "Supplier lookup unavailable" }, 503);
    const rows = (matches || []).filter(x => ["lipseys","sports_south"].includes(x.source));
    const { data: links, error: linkError } = rows.length ? await db.from("cc_supplier_listing_links")
      .select("supplier,supplier_product_id,listing_url,verification_status")
      .in("supplier_product_id", rows.map(x => x.source_id)) : { data: [], error: null };
    if (linkError) return json({ error: "Supplier lookup unavailable" }, 503);
    const verified = new Map((links || []).filter(x => x.verification_status === "verified")
      .map(x => [x.supplier + ":" + x.supplier_product_id, x.listing_url]));
    const ranked = rows.map(x => {
      const upcMatch = !!upc && String(x.upc || "").replace(/[^0-9]/g, "") === upc;
      const mpnMatch = !!mpn && clean(String(x.manufacturer_part_number || "")) === clean(mpn);
      const caliberMatch = !!caliber && clean(String(x.caliber || "")) === clean(caliber);
      const score = (upcMatch ? 100 : 0) + (mpnMatch ? 60 : 0) + (caliberMatch ? 20 : 0);
      const listing_url = verified.get(x.source + ":" + x.source_id) ||
        (x.source === "lipseys" && /^[A-Za-z0-9_-]{2,80}$/.test(x.source_id)
          ? "https://www.lipseys.com/itemdetail?itemno=" + encodeURIComponent(x.source_id) : null);
      return { ...x, listing_url, match_level: upcMatch ? "exact_upc" : mpnMatch ? "exact_part_number" : caliberMatch ? "caliber_match" : "model_family", match_score: score };
    }).sort((a,b) => b.match_score-a.match_score || a.model.localeCompare(b.model) || a.source.localeCompare(b.source) || a.source_id.localeCompare(b.source_id));
    return json({ success: true, matches: ranked.slice(0, 30), total_matches: ranked.length, truncated: (matches || []).length === 200 || ranked.length > 30, exact_identifier_match: ranked.some(x => x.match_score >= 60) });
  }
  if (action === "submit-review") {
    const productId = Number(body.product_id);
    const decision = String(body.decision || "");
    const notes = String(body.notes || "").trim();
    if (!Number.isSafeInteger(productId) || productId <= 0 || !["distinct_variant","suspected_data_error","needs_supplier_verification"].includes(decision) || notes.length > 2000 || (decision !== "distinct_variant" && notes.length < 5)) return json({ error: "Invalid review" }, 400);
    const { data: product, error: productError } = await db.from("cc_accessory_identifier_conflicts").select("id").eq("id", productId).eq("product_category", category as string).maybeSingle();
    if (productError) return json({ error: "Review unavailable" }, 503);
    if (!product) return json({ error: "Product is not in conflict review" }, 404);
    const { data, error } = await db.from("cc_accessory_identifier_review_events").insert({ product_id: productId, reviewer_user_id: userData.user.id, decision, notes }).select("id,product_id,decision,notes,created_at").single();
    if (error) return json({ error: "Could not save review" }, 503);
    return json({ success: true, review: data });
  }
  if (action === "review-history") {
    const productId = Number(body.product_id);
    if (!Number.isSafeInteger(productId) || productId <= 0) return json({ error: "Invalid product" }, 400);
    const { data: product, error: productError } = await db.from("cc_accessory_identifier_conflicts").select("id").eq("id", productId).eq("product_category", category as string).maybeSingle();
    if (productError) return json({ error: "Review unavailable" }, 503);
    if (!product) return json({ error: "Product is not in conflict review" }, 404);
    const { data, error } = await db.from("cc_accessory_identifier_review_events").select("id,product_id,reviewer_user_id,decision,notes,created_at").eq("product_id", productId).order("created_at", { ascending: false }).limit(50);
    if (error) return json({ error: "Review history unavailable" }, 503);
    const { data: names, error: namesError } = await db.from("cc_staff").select("user_id,display_name").in("user_id", [...new Set((data || []).map(x => x.reviewer_user_id))]);
    if (namesError) return json({ error: "Review history unavailable" }, 503);
    const nameMap = new Map((names || []).map(x => [x.user_id, x.display_name || "Employee"]));
    return json({ success: true, reviews: (data || []).map(x => ({ ...x, reviewer_display_name: nameMap.get(x.reviewer_user_id) || "Former employee" })) });
  }
  if (action === "review-summary") {
    const { data: conflicts, error: conflictsError } = await db.from("cc_accessory_identifier_conflicts").select("id").eq("product_category", category as string).limit(1000);
    if (conflictsError) return json({ error: "Review summary unavailable" }, 503);
    const ids = (conflicts || []).map(x => x.id);
    if (!ids.length) return json({ success: true, summary: { total: 0, unreviewed: 0, distinct_variant: 0, suspected_data_error: 0, needs_supplier_verification: 0 } });
    const { data: latest, error } = await db.from("cc_accessory_identifier_review_latest").select("product_id,decision").in("product_id", ids);
    if (error) return json({ error: "Review summary unavailable" }, 503);
    const summary = { total: ids.length, unreviewed: ids.length - (latest || []).length, distinct_variant: 0, suspected_data_error: 0, needs_supplier_verification: 0 };
    for (const x of (latest || [])) if (x.decision in summary) (summary as Record<string,number>)[x.decision]++;
    return json({ success: true, summary });
  }
  if (action === "conflicts") {
    const { data, error } = await db.from("cc_accessory_identifier_conflicts")
      .select("id,product_category,manufacturer,model,upc,manufacturer_part_number,review_status,conflict_group_size")
      .eq("product_category", category as string).order("manufacturer").order("manufacturer_part_number").order("id").limit(100);
    if (error) return json({ error: "Conflict review unavailable" }, 503);
    const ids = (data || []).map(x => x.id);
    const { data: latest, error: latestError } = ids.length ? await db.from("cc_accessory_identifier_review_latest").select("product_id,decision,notes,created_at,reviewer_display_name").in("product_id", ids) : { data: [], error: null };
    if (latestError) return json({ error: "Conflict review unavailable" }, 503);
    const byId = new Map((latest || []).map(x => [x.product_id, x]));
    return json({ success: true, provisional: true, conflicts: (data || []).map(x => ({ ...x, latest_staff_review: byId.get(x.id) || null })) });
  }
  let query = db.from("cc_accessory_internal_provisional_catalog")
    .select("id,product_category,manufacturer,model,upc,manufacturer_part_number,specifications,review_status,source_listing_count")
    .eq("product_category", category as string);
  if (action === "manufacturers") {
    // Fetch bounded catalog records for aggregation; pagination is required for larger sets.
    const all: Array<{manufacturer:string}> = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const { data, error } = await query.range(offset, offset + 499);
      if (error) return json({ error: "Catalog unavailable" }, 503);
      all.push(...(data || []));
      if ((data || []).length < 500) break;
    }
    const counts = new Map<string, number>();
    for (const p of all) counts.set(p.manufacturer, (counts.get(p.manufacturer) || 0) + 1);
    return json({ success: true, provisional: true,
      manufacturers: [...counts].map(([manufacturer, product_count]) => ({ manufacturer, product_count }))
        .sort((a,b) => a.manufacturer.localeCompare(b.manufacturer)) });
  }
  const manufacturer = String(body.manufacturer || "").trim().slice(0, 120);
  const search = String(body.search || "").trim().slice(0, 100);
  const limit = Math.min(50, Math.max(1, Number(body.limit) || 25));
  const offset = Math.min(10000, Math.max(0, Number(body.offset) || 0));
  if (manufacturer) query = query.eq("manufacturer", manufacturer);
  if (search) query = query.ilike("model", "%" + search.replace(/[%_,]/g, "") + "%");
  const { data, error } = await query.order("model").order("id").range(offset, offset + limit);
  if (error) return json({ error: "Catalog unavailable" }, 503);
  return json({ success: true, provisional: true, products: (data || []).slice(0, limit)
    .map(p => ({ ...p, source: "internal_provisional", source_id: String(p.id), currently_listed: false })),
    hasMore: (data || []).length > limit });
});
