const client = require("../config/db");
const axios = require("axios");
const { getAccessToken } = require("../config/authService");

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

const create_Tenant = async (req, res) => {
  try {
    const {
      entratenantid,
      tenantname,
      tenantemail,
      createdby,
      dynamicsaccountid,
      admingroupid,
      usergroupid,
    } = req.body;

    const finalTenantId = entratenantid || null;
    const finalCreatedBy = createdby || req.user?.oid || null;

    if (!finalTenantId || !tenantname) {
      return res.status(400).json({
        error: "entratenantid and tenantname are required",
      });
    }

    const result = await client.query(
      "SELECT public.tenant_create($1, $2, $3, $4, $5, $6, $7) AS tenantuuid",
      [
        finalTenantId,
        tenantname,
        tenantemail || null,
        finalCreatedBy || null,
        dynamicsaccountid || null,
        admingroupid || null,
        usergroupid || null,
      ],
    );

    return res.status(201).json({
      tenantuuid: result.rows[0]?.tenantuuid ?? null,
    });
  } catch (err) {
    console.error("create_Tenant error:", err.message);

    if (err.message?.includes("VALIDATION_ERROR")) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const update_Tenant = async (req, res) => {
  try {
    const {
      tenantuuid,
      entratenantid,
      tenantname,
      tenantemail,
      dynamicsaccountid,
      admingroupid,
      usergroupid,
      isactive,
      isconsented,
    } = req.body;

    const parseBool = (value, key) => {
      if (value === undefined || value === null || value === "") return null;
      if (value === true || value === "true") return true;
      if (value === false || value === "false") return false;
      throw new Error(`VALIDATION_ERROR: ${key} must be true or false`);
    };

    if (!tenantuuid || !entratenantid || !tenantname) {
      return res.status(400).json({
        error: "tenantuuid, entratenantid, and tenantname are required",
      });
    }

    await client.query(
      "SELECT public.tenant_update($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [
        tenantuuid,
        entratenantid,
        tenantname,
        tenantemail || null,
        dynamicsaccountid || null,
        admingroupid || null,
        usergroupid || null,
        parseBool(isactive, "isactive"),
        parseBool(isconsented, "isconsented"),
      ],
    );

    return res.status(200).json({
      message: "Tenant updated successfully",
      tenantuuid,
    });
  } catch (err) {
    console.error("update_Tenant error:", err.message);

    if (err.message?.includes("VALIDATION_ERROR")) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const get_Tenants = async (req, res) => {
  try {
    const {
      tenantid,
      entratenantid,
      dynamicsaccountid,
      isconsented,
      isactive,
    } = req.query;

    const parsedTenantId =
      tenantid === undefined || tenantid === null || tenantid === ""
        ? null
        : String(tenantid);

    if (parsedTenantId !== null && isNaN(Number(parsedTenantId))) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR: tenantid must be a number" });
    }

    const result = await client.query(
      "SELECT * FROM public.tenant_get_all($1, $2, $3, $4, $5)",
      [
        parsedTenantId,
        entratenantid || null,
        dynamicsaccountid || null,
        isconsented || null,
        isactive || null,
      ],
    );

    const rows = result.rows.map((row) => ({
      tenantid: row.v_tenantid,
      tenantuuid: row.v_tenantuuid,
      entratenantid: row.v_entratenantid,
      tenantname: row.v_tenantname,
      tenantemail: row.v_tenantemail,
      createdat: row.v_createdat,
      createdby: row.v_createdby,
      dynamicsaccountid: row.v_dynamicsaccountid,
      admingroupid: row.v_admingroupid,
      usergroupid: row.v_usergroupid,
      isconsented: row.v_isconsented,
      isactive: row.v_isactive,
    }));

    return res.status(200).json(rows);
  } catch (err) {
    console.error("get_Tenants error:", err.message);

    if (err.message?.includes("VALIDATION_ERROR")) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const check_ConsentStatus = async (req, res) => {
  try {
    // ── STEP 1: Get tenantId from the validated token ──────────────────────
    const tenantId = req.tenantId;
    console.log("[CONSENT STATUS] Step 1 — tenantId from token:", tenantId);

    if (!tenantId) {
      return res.status(400).json({ error: "Unable to resolve tenantId from token" });
    }

    // ── STEP 2: Check if tenant already exists in DB ───────────────────────
    console.log("[CONSENT STATUS] Step 2 — Querying DB for tenant...");
    const existingResult = await client.query(
      `SELECT * FROM public.tenant_get_map_with_entratenantid()
       WHERE entratenantid = $1`,
      [tenantId],
    );

    let row = existingResult.rows[0] ?? null;
    console.log("[CONSENT STATUS] Step 2 — DB result:", row ? "Found" : "Not found");

    // ── STEP 3: If not found, call Graph with the USER'S token, then insert ─
    if (!row) {
      console.log("[CONSENT STATUS] Step 3 — Tenant not in DB. Calling Graph with user token...");

      // Use the user's own Bearer token from the request header (already validated)
      // This avoids needing app-level consent which doesn't exist yet for new tenants
      const userBearerToken = req.headers?.authorization?.split(" ")[1] ?? null;

      if (!userBearerToken) {
        console.error("[CONSENT STATUS] Step 3 — No bearer token found in request headers");
        return res.status(401).json({ error: "Missing authorization token" });
      }

      let tenantName = null;
      let tenantEmail = null;

      try {
        console.log("[CONSENT STATUS] Step 3 — Fetching org info from Graph...");
        const orgRes = await axios.get(`${GRAPH_URL}/organization`, {
          headers: { Authorization: `Bearer ${userBearerToken}` },
          params: { $select: "displayName,technicalNotificationMails" },
          timeout: 10000,
        });

        const org = orgRes.data.value?.[0];
        if (org) {
          tenantName  = org.displayName ?? null;
          tenantEmail = org.technicalNotificationMails?.[0] ?? null;
          console.log(`[CONSENT STATUS] Step 3 — Graph returned: name="${tenantName}" email="${tenantEmail}"`);
        } else {
          console.warn("[CONSENT STATUS] Step 3 — Graph returned no org data, falling back to token claims");
        }
      } catch (graphErr) {
        // Graph failed (e.g. insufficient scope on user token) — fall back to token claims
        console.warn("[CONSENT STATUS] Step 3 — Graph call failed, falling back to token claims:", graphErr.message);
      }

      // Fallback: use token claims if Graph didn't return anything
      if (!tenantName) {
        tenantName =
          req.user?.name ||
          req.user?.upn?.split("@")?.[1] ||
          tenantId;
        console.log(`[CONSENT STATUS] Step 3 — Using fallback tenantName: "${tenantName}"`);
      }
      if (!tenantEmail) {
        tenantEmail = req.user?.upn ?? req.user?.email ?? null;
        console.log(`[CONSENT STATUS] Step 3 — Using fallback tenantEmail: "${tenantEmail}"`);
      }

      const createdBy = req.user?.oid ?? null;

      // ── STEP 4: Insert new tenant into DB ─────────────────────────────────
      console.log("[CONSENT STATUS] Step 4 — Inserting new tenant into DB...");
      await client.query(
        "SELECT public.tenant_create($1, $2, $3, $4, $5, $6, $7) AS tenantuuid",
        [tenantId, tenantName, tenantEmail, createdBy, null, null, null],
      );
      console.log(`[CONSENT STATUS] Step 4 — Tenant inserted: ${tenantId} (${tenantName})`);

      // ── STEP 5: Re-fetch the newly created row ────────────────────────────
      console.log("[CONSENT STATUS] Step 5 — Re-fetching newly created tenant from DB...");
      const newResult = await client.query(
        `SELECT * FROM public.tenant_get_map_with_entratenantid()
         WHERE entratenantid = $1`,
        [tenantId],
      );
      row = newResult.rows[0] ?? null;

      if (!row) {
        console.error("[CONSENT STATUS] Step 5 — Re-fetch returned nothing after insert");
        return res.status(500).json({ error: "Tenant was created but could not be retrieved" });
      }

      console.log("[CONSENT STATUS] Step 5 — Re-fetch successful");
    }

    // ── STEP 6: Read flags from row and return ─────────────────────────────
    const consented  = row.isconsented  === true;
    const isactive   = row.isactive     === true;
    const isapproved = row.isapproved   === true;

    console.log(
      `[CONSENT STATUS] Step 6 — Final flags: consented=${consented} isactive=${isactive} isapproved=${isapproved}`,
    );

    return res.status(200).json({ consented, isactive, isapproved, tenantId });

  } catch (err) {
    console.error("[CONSENT STATUS ERROR]", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


// ─── Get Tenant Information ───────────────────────────────────────────────────
// Extracts tid from the Bearer access token (req.user.tid injected by validateToken middleware),
// then calls Microsoft Graph /organization to retrieve full tenant details.
const get_TenantInfo = async (req, res) => {
  try {
    // tid is populated from the decoded JWT by your validateToken middleware
    const tenantId = req.user?.tid || req.tenantId;

    if (!tenantId) {
      return res
        .status(400)
        .json({ error: "Unable to resolve tenantId from access token" });
    }

    const token = await getAccessToken(tenantId);
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch organization (tenant) info from Graph
    const orgRes = await axios.get(`${GRAPH_URL}/organization`, {
      headers,
      params: {
        $select: [
          "id",
          "displayName",
          "verifiedDomains",
          "assignedPlans",
          "createdDateTime",
          "country",
          "countryLetterCode",
          "city",
          "state",
          "street",
          "postalCode",
          "preferredLanguage",
          "tenantType",
          "onPremisesSyncEnabled",
          "onPremisesLastSyncDateTime",
          "technicalNotificationMails",
          "defaultUsageLocation",
          "directorySizeQuota",
        ].join(","),
      },
      timeout: 10000,
    });

    const org = orgRes.data.value?.[0];

    if (!org) {
      return res
        .status(404)
        .json({ error: "Tenant organization not found in Microsoft Graph" });
    }

    // Resolve default domain from verifiedDomains
    const defaultDomain =
      org.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;
    const initialDomain =
      org.verifiedDomains?.find((d) => d.isInitial)?.name ?? null;

    return res.status(200).json({
      tenantId: org.id,
      displayName: org.displayName,
      defaultDomain,
      initialDomain,
      verifiedDomains: org.verifiedDomains ?? [],
      createdDateTime: org.createdDateTime ?? null,
      country: org.country ?? null,
      countryLetterCode: org.countryLetterCode ?? null,
      city: org.city ?? null,
      state: org.state ?? null,
      street: org.street ?? null,
      postalCode: org.postalCode ?? null,
      preferredLanguage: org.preferredLanguage ?? null,
      tenantType: org.tenantType ?? null,
      onPremisesSyncEnabled: org.onPremisesSyncEnabled ?? null,
      onPremisesLastSyncDateTime: org.onPremisesLastSyncDateTime ?? null,
      technicalNotificationMails: org.technicalNotificationMails ?? [],
      defaultUsageLocation: org.defaultUsageLocation ?? null,
      directorySizeQuota: org.directorySizeQuota ?? null,
      assignedPlans: org.assignedPlans ?? [],
    });
  } catch (err) {
    console.error("get_TenantInfo error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  create_Tenant,
  update_Tenant,
  get_Tenants,
  check_ConsentStatus,
  get_TenantInfo,
};
