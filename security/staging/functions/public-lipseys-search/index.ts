
/*
  COPPER CUSTOM — PUBLIC LIPSEY'S SEARCH V3.2 (UNIFIED FIREARM CATALOG)

  Supports:
  - Accessory, Optic, NFA category searches
  - Product manufacturers
  - Product search and individual product details
  - Firearm types and actions
  - Firearm manufacturers
  - Firearm search and individual firearm details

  Requires existing SQL functions:
  cc_allow_public_request
  builder_product_categories
  builder_product_manufacturers
  builder_firearm_filters
  builder_firearm_manufacturers
  builder_firearm_products
  builder_unified_firearm_filters_v2
  builder_unified_firearm_manufacturers_v2
  builder_unified_firearm_products_v2
  builder_unified_firearm_product_v2
  builder_unified_firearm_model_variants_v2

  Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  BUILDER_RATE_LIMIT_SALT

  Verify JWT: OFF
*/

import { gatewayIp, limiterHash } from "../_shared/security.ts";

const ALLOWED_ORIGINS = new Set([
  "https://coppercustom.com",
  "https://www.coppercustom.com",
]);

const ACTIONS = new Set([
  "light-manufacturers",
  "light-products",
  "categories",
  "manufacturers",
  "products",
  "product",
  "firearm-filters",
  "firearm-manufacturers",
  "firearm-products",
  "firearm-product",
  "unified-firearm-filters",
  "unified-firearm-manufacturers",
  "unified-firearm-products",
  "unified-firearm-product",
  "unified-firearm-model-variants",
]);

const PRODUCT_FIELDS = [
  "lipseys_item_no",
  "item_type",
  "product_type",
  "manufacturer",
  "model",
  "manufacturer_model_no",
  "family",
  "description_1",
  "description_2",
  "caliber",
].join(",");

const FIREARM_FIELDS = [
  "lipseys_item_no",
  "manufacturer",
  "model",
  "firearm_type",
  "weapon_class",
  "caliber",
  "action",
  "barrel_length",
  "manufacturer_model_no",
  "description_1",
  "family",
  "finish",
  "capacity",
].join(",");

type JsonObject = Record<string, unknown>;

function isObject(x: unknown): x is JsonObject {
  return x !== null &&
    typeof x === "object" &&
    !Array.isArray(x);
}

function response(
  data: JsonObject,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
      ...(origin && ALLOWED_ORIGINS.has(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
    },
  });
}

function str(
  x: unknown,
  max = 120,
): string | null {
  if (x === null || x === undefined || x === "") {
    return null;
  }

  if (typeof x !== "string" || x.length > max) {
    throw new Error("Invalid filter");
  }

  return x.trim() || null;
}

function integer(
  x: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (x === undefined || x === null) return fallback;

  if (
    typeof x !== "number" ||
    !Number.isSafeInteger(x) ||
    x < min ||
    x > max
  ) {
    throw new Error("Invalid pagination");
  }

  return x;
}


function validateSearch(
  x: unknown,
): string | null {
  const s = str(x, 80);

  if (!s) return null;

  if (!/^[\p{L}\p{N}\s\-\/+#&']+$/u.test(s)) {
    throw new Error("Invalid filter");
  }

  return s;
}

function escapeLike(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return response({
      success: false,
      error: "Origin not allowed",
    }, 403, origin);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
        "Vary": "Origin",
        ...(origin
          ? { "Access-Control-Allow-Origin": origin }
          : {}),
      },
    });
  }

  if (req.method !== "POST") {
    return response({
      success: false,
      error: "Method not allowed",
    }, 405, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const salt = Deno.env.get("BUILDER_RATE_LIMIT_SALT");

  // Supabase now injects named secret API keys as a JSON object.
  // The default key is the server-side sb_secret_... key.
  // Do NOT send this API key as a Bearer token: new Supabase API
  // keys are not JWTs and must be sent in the apikey header only.
  let key: string | null = null;

  try {
    if (rawSecretKeys) {
      const secretKeys: unknown = JSON.parse(rawSecretKeys);
      if (
        secretKeys !== null &&
        typeof secretKeys === "object" &&
        !Array.isArray(secretKeys)
      ) {
        const candidate = (secretKeys as Record<string, unknown>)["default"];
        if (typeof candidate === "string" && candidate.startsWith("sb_secret_")) {
          key = candidate;
        }
      }
    }
  } catch {
    console.error("SUPABASE_SECRET_KEYS is not valid JSON");
  }

  if (!url || !key || !salt || salt.length < 32) {
    console.error("Server configuration unavailable", {
      hasSupabaseUrl: Boolean(url),
      hasDefaultSecretKey: Boolean(key),
      hasRateLimitSalt: Boolean(salt && salt.length >= 32),
    });

    return response({
      success: false,
      error: "Server configuration unavailable",
    }, 503, origin);
  }

  // Secret API keys authenticate through apikey only.
  // Do not add Authorization: Bearer <sb_secret_...>.
  const dbHeaders = {
    apikey: key,
    "Content-Type": "application/json",
  };

  async function dbRequest(
    path: string,
    body?: JsonObject,
  ): Promise<unknown> {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: dbHeaders,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      await r.body?.cancel();
      console.error("Database request failed", path.split("?")[0], r.status);

      throw new Error(`Database request failed (${r.status})`);
    }

    return await r.json();
  }

  try {
    // --------------------------------------------
    // RATE LIMIT
    // --------------------------------------------

    const ip = gatewayIp(req.headers, Deno.env.get("TRUST_MANAGED_GATEWAY_IP") === "true");
    try {
      const hash = await limiterHash(ip, salt);
      const allowed = await dbRequest("rpc/cc_allow_public_request", {
        p_scope: "search",
        p_client_hash: hash,
      });

      if (typeof allowed !== "boolean") throw new Error("limiter_unavailable");
      if (!allowed) {
        console.warn("search_rate_limited", ip === null ? "shared" : "gateway");
        return response({
          success: false,
          error: "Too many requests. Try again shortly.",
        }, 429, origin);
      }
    } catch {
      console.error("search_limiter_unavailable");
      return response({
        success: false,
        error: "Search temporarily unavailable",
      }, 503, origin);
    }

    // --------------------------------------------
    // REQUEST VALIDATION
    // --------------------------------------------

    const raw = await req.text();

    if (raw.length > 4000) {
      return response({
        success: false,
        error: "Request too large",
      }, 413, origin);
    }

    const input: unknown = JSON.parse(raw);

    if (!isObject(input)) {
      throw new Error("Invalid filter");
    }

    const action = str(input.action, 40);

    if (!action || !ACTIONS.has(action)) {
      return response({
        success: false,
        error: "Invalid action",
      }, 400, origin);
    }

    // --------------------------------------------
    // PUBLISHED WEAPON LIGHTS (SUPPLIER-DEDUPlICATED)
    // No unverified candidates are exposed by this endpoint.
    // Existing Lipsey's actions remain available as fallback.
    // --------------------------------------------
    if (action === "light-manufacturers") {
      const rows = await dbRequest("cc_weapon_light_employee_visible?select=manufacturer&order=manufacturer.asc&limit=1000");
      if (!Array.isArray(rows)) throw new Error("Invalid database response");
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (typeof row.manufacturer !== "string") continue;
        counts.set(row.manufacturer, (counts.get(row.manufacturer) || 0) + 1);
      }
      return response({success:true,action,manufacturers:[...counts].map(([name,count])=>({name,count})),source:"verified_unified"},200,origin);
    }
    if (action === "light-products") {
      const manufacturer = str(input.manufacturer,120);
      const search = validateSearch(input.search);
      const limit = integer(input.limit,25,1,50);
      const offset = integer(input.offset,0,0,10000);
      const params = new URLSearchParams({
        select:"id,manufacturer,model,upc,manufacturer_part_number",
        order:"model.asc,id.asc",
        limit:String(limit+1),offset:String(offset)
      });
      if (manufacturer) params.set("manufacturer",`eq.${manufacturer}`);
      if (search) params.set("model",`ilike.*${escapeLike(search)}*`);
      const rows = await dbRequest(`cc_weapon_light_employee_visible?${params}`);
      if (!Array.isArray(rows)) throw new Error("Invalid database response");
      return response({success:true,action,products:rows.slice(0,limit),limit,offset,hasMore:rows.length>limit,source:"verified_unified"},200,origin);
    }

    // --------------------------------------------
    // FIREARM ACTIONS
    // --------------------------------------------

    if (action.startsWith("firearm-") || action.startsWith("unified-firearm-")) {
      const weaponClass = str(input.weaponClass, 40);
      const firearmType = str(input.firearmType, 100);
      // Validate the customer preference, but do not use it to filter catalog results.
      // The frontend must retain this value in its build-request summary.
      const firearmActionPreference = str(input.firearmAction, 100);
      void firearmActionPreference;
      const manufacturer = str(input.manufacturer, 120);

      if (
        weaponClass &&
        ![
          "Rifle",
          "Pistol",
          "Shotgun",
          "Unclassified",
        ].includes(weaponClass)
      ) {
        throw new Error("Invalid filter");
      }

      // Unified V2 actions use the publication-aware, identifier-enriched catalog.
      // Legacy actions below remain unchanged.
      if (action === "unified-firearm-filters") {
        const rows = await dbRequest("rpc/builder_unified_firearm_filters_v2", {
          p_weapon_class: weaponClass,
          p_firearm_type: firearmType,
        });
        if (!Array.isArray(rows)) throw new Error("Invalid database response");
        return response({ success: true, action, filters: rows }, 200, origin);
      }

      if (action === "unified-firearm-manufacturers") {
        const rows = await dbRequest("rpc/builder_unified_firearm_manufacturers_v2", {
          p_weapon_class: weaponClass,
          p_firearm_type: firearmType,
          p_action: null,
        });
        if (!Array.isArray(rows)) throw new Error("Invalid database response");
        return response({ success: true, action, manufacturers: rows }, 200, origin);
      }

      // --------------------------------------------
      // UNIFIED FIREARM MODEL VARIANTS
      // Returns the original source records associated with
      // one deduplicated manufacturer/model selection.
      // --------------------------------------------

      if (action === "unified-firearm-model-variants") {
        const model = str(input.model, 160);

        if (!manufacturer || !model) {
          return response({
            success: false,
            error: "manufacturer and model are required",
          }, 400, origin);
        }

        // The SQL function caps its result at 100 rows.
        // Request one extra row to determine whether another page exists.
        // Therefore the public page size is capped at 99.
        const limit = integer(input.limit, 25, 1, 99);
        const offset = integer(input.offset, 0, 0, 10000);

        const rows = await dbRequest(
          "rpc/builder_unified_firearm_model_variants_v2",
          {
            p_manufacturer: manufacturer,
            p_model: model,
            p_weapon_class: weaponClass,
            p_firearm_type: firearmType,
            p_limit: limit + 1,
            p_offset: offset,
          },
        );

        if (!Array.isArray(rows)) {
          throw new Error("Invalid database response");
        }

        return response({
          success: true,
          action,
          manufacturer,
          model,
          variants: rows.slice(0, limit),
          limit,
          offset,
          hasMore: rows.length > limit,
        }, 200, origin);
      }

      if (action === "unified-firearm-product") {
        const source = str(input.source, 20);
        const sourceId = str(input.sourceId, 120);
        if (!source || !["lipseys", "gunspec", "sports_south"].includes(source) || !sourceId) {
          return response({ success: false, error: "Valid source and sourceId required" }, 400, origin);
        }
        const rows = await dbRequest("rpc/builder_unified_firearm_product_v2", {
          p_source: source,
          p_source_id: sourceId,
        });
        if (!Array.isArray(rows)) throw new Error("Invalid database response");
        if (!rows.length) {
          return response({ success: false, error: "Firearm not found" }, 404, origin);
        }
        return response({ success: true, action, product: rows[0] }, 200, origin);
      }

      if (action === "unified-firearm-products") {
        const limit = integer(input.limit, 25, 1, 50);
        const offset = integer(input.offset, 0, 0, 10000);
        const search = validateSearch(input.search);
        const rows = await dbRequest("rpc/builder_unified_firearm_products_v2", {
          p_weapon_class: weaponClass,
          p_firearm_type: firearmType,
          p_action: null,
          p_manufacturer: manufacturer,
          p_search: search,
          p_limit: limit + 1,
          p_offset: offset,
        });
        if (!Array.isArray(rows)) throw new Error("Invalid database response");
        return response({
          success: true,
          action,
          products: rows.slice(0, limit),
          limit,
          offset,
          hasMore: rows.length > limit,
        }, 200, origin);
      }

      // Available firearm types and actions

      if (action === "firearm-filters") {
        const rows = await dbRequest(
          "rpc/builder_firearm_filters",
          {
            p_weapon_class: weaponClass,
            p_firearm_type: firearmType,
          },
        );

        if (!Array.isArray(rows)) {
          throw new Error("Invalid database response");
        }

        return response({
          success: true,
          action,
          filters: rows,
        }, 200, origin);
      }

      // Firearm manufacturers

      if (action === "firearm-manufacturers") {
        const rows = await dbRequest(
          "rpc/builder_firearm_manufacturers",
          {
            p_weapon_class: weaponClass,
            p_firearm_type: firearmType,
            p_action: null,
          },
        );

        if (!Array.isArray(rows)) {
          throw new Error("Invalid database response");
        }

        return response({
          success: true,
          action,
          manufacturers: rows,
        }, 200, origin);
      }

      // Individual firearm lookup

      if (action === "firearm-product") {
        const itemNo = str(input.itemNo, 100);

        if (!itemNo) {
          return response({
            success: false,
            error: "itemNo required",
          }, 400, origin);
        }

        const params = new URLSearchParams({
          select: FIREARM_FIELDS,
          lipseys_item_no: `eq.${itemNo}`,
          currently_listed: "eq.true",
          limit: "1",
        });

        const rows = await dbRequest(
          `lipseys_firearms?${params}`,
        );

        if (!Array.isArray(rows)) {
          throw new Error("Invalid database response");
        }

        if (!rows.length) {
          return response({
            success: false,
            error: "Firearm not found",
          }, 404, origin);
        }

        return response({
          success: true,
          action,
          product: rows[0],
        }, 200, origin);
      }

      // Firearm product search

      const limit = integer(input.limit, 25, 1, 50);
      const offset = integer(input.offset, 0, 0, 10000);
      const search = validateSearch(input.search);

      const rows = await dbRequest(
        "rpc/builder_firearm_products",
        {
          p_weapon_class: weaponClass,
          p_firearm_type: firearmType,
          p_action: null,
          p_manufacturer: manufacturer,
          p_search: search,
          p_limit: limit + 1,
          p_offset: offset,
        },
      );

      if (!Array.isArray(rows)) {
        throw new Error("Invalid database response");
      }

      return response({
        success: true,
        action,
        products: rows.slice(0, limit),
        limit,
        offset,
        hasMore: rows.length > limit,
      }, 200, origin);
    }

    // --------------------------------------------
    // ACCESSORY / OPTIC / NFA ACTIONS
    // --------------------------------------------

    const itemType = str(input.itemType, 30);

    if (
      itemType &&
      !["Accessory", "Optic", "NFA"].includes(itemType)
    ) {
      throw new Error("Invalid filter");
    }

    const productType = str(input.productType, 120);
    const manufacturer = str(input.manufacturer, 120);

    // Categories

    if (action === "categories") {
      const rows = await dbRequest(
        "rpc/builder_product_categories",
        { p_item_type: itemType },
      );

      if (!Array.isArray(rows)) {
        throw new Error("Invalid database response");
      }

      return response({
        success: true,
        action,
        categories: rows.map((r) => ({
          name: r.name,
          count: Number(r.product_count),
        })),
      }, 200, origin);
    }

    // Manufacturers

    if (action === "manufacturers") {
      const rows = await dbRequest(
        "rpc/builder_product_manufacturers",
        {
          p_item_type: itemType,
          p_product_type: productType,
        },
      );

      if (!Array.isArray(rows)) {
        throw new Error("Invalid database response");
      }

      return response({
        success: true,
        action,
        manufacturers: rows.map((r) => ({
          name: r.name,
          count: Number(r.product_count),
        })),
      }, 200, origin);
    }

    // Individual accessory / optic / NFA product

    if (action === "product") {
      const itemNo = str(input.itemNo, 100);

      if (!itemNo) {
        return response({
          success: false,
          error: "itemNo required",
        }, 400, origin);
      }

      const params = new URLSearchParams({
        select: PRODUCT_FIELDS,
        lipseys_item_no: `eq.${itemNo}`,
        currently_listed: "eq.true",
        limit: "1",
      });

      const rows = await dbRequest(
        `lipseys_products?${params}`,
      );

      if (!Array.isArray(rows)) {
        throw new Error("Invalid database response");
      }

      if (!rows.length) {
        return response({
          success: false,
          error: "Product not found",
        }, 404, origin);
      }

      return response({
        success: true,
        action,
        product: rows[0],
      }, 200, origin);
    }

    // Paginated accessory / optic / NFA search

    const limit = integer(input.limit, 25, 1, 50);
    const offset = integer(input.offset, 0, 0, 10000);
    const search = validateSearch(input.search);

    const params = new URLSearchParams({
      select: PRODUCT_FIELDS,
      currently_listed: "eq.true",
      order: "model.asc,lipseys_item_no.asc",
      limit: String(limit + 1),
      offset: String(offset),
    });

    if (itemType) {
      params.set("item_type", `eq.${itemType}`);
    }

    if (productType) {
      params.set("product_type", `eq.${productType}`);
    }

    if (manufacturer) {
      params.set("manufacturer", `eq.${manufacturer}`);
    }

    if (search) {
      const term = escapeLike(search);

      params.set(
        "or",
        `(model.ilike.*${term}*,manufacturer.ilike.*${term}*,description_1.ilike.*${term}*)`,
      );
    }

    const rows = await dbRequest(
      `lipseys_products?${params}`,
    );

    if (!Array.isArray(rows)) {
      throw new Error("Invalid database response");
    }

    return response({
      success: true,
      action,
      products: rows.slice(0, limit),
      limit,
      offset,
      hasMore: rows.length > limit,
    }, 200, origin);

  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (
        error instanceof Error &&
        [
          "Invalid filter",
          "Invalid pagination",
        ].includes(error.message)
      )
    ) {
      return response({
        success: false,
        error: "Invalid request parameters",
      }, 400, origin);
    }

    console.error("public_search_failed");

    return response({
      success: false,
      error: "Catalog temporarily unavailable",
    }, 502, origin);
  }
});
