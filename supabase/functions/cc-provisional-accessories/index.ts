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
  if (!["manufacturers", "products", "conflicts"].includes(String(action)) ||
      !["optic", "suppressor"].includes(String(category))) return json({ error: "Unsupported request" }, 400);
  if (action === "conflicts") {
    const { data, error } = await db.from("cc_accessory_identifier_conflicts")
      .select("id,product_category,manufacturer,model,upc,manufacturer_part_number,review_status,conflict_group_size")
      .eq("product_category", category as string).order("manufacturer").order("manufacturer_part_number").order("id").limit(100);
    if (error) return json({ error: "Conflict review unavailable" }, 503);
    return json({ success: true, provisional: true, conflicts: data || [] });
  }
  let query = db.from("cc_accessory_internal_provisional_catalog")
    .select("id,product_category,manufacturer,model,review_status,source_listing_count")
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
