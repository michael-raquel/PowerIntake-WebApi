const client = require("../config/db");
const axios = require("axios");
const { getAccessToken } = require("../config/authService");
const { getDynamicsToken } = require('../utils/dynamicsToken');

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

// ─── Create Tenant ────────────────────────────────────────────────────────────

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

// ─── Update Tenant ────────────────────────────────────────────────────────────

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
      isapproved,
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
      "SELECT public.tenant_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
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
        parseBool(isapproved, "isapproved"),
      ]
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

// ─── Get Tenants ──────────────────────────────────────────────────────────────

const get_Tenants = async (req, res) => {
  try {
    const {
      tenantid,
      entratenantid,
      dynamicsaccountid,
      isconsented,
      isactive,
      isapproved,
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
      "SELECT * FROM public.tenant_get_all($1, $2, $3, $4, $5, $6)",
      [
        parsedTenantId,
        entratenantid || null,
        dynamicsaccountid || null,
        isconsented || null,
        isactive || null,
        isapproved || null,
      ]
    );

    const rows = result.rows.map((row) => ({
      tenantid:         row.v_tenantid,
      tenantuuid:       row.v_tenantuuid,
      entratenantid:    row.v_entratenantid,
      tenantname:       row.v_tenantname,
      tenantemail:      row.v_tenantemail,
      createdat:        row.v_createdat,
      createdby:        row.v_createdby,
      dynamicsaccountid: row.v_dynamicsaccountid,
      admingroupid:     row.v_admingroupid,
      usergroupid:      row.v_usergroupid,
      isconsented:      row.v_isconsented,
      isactive:         row.v_isactive,
      isapproved:       row.v_isapproved,
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

// ─── Check Consent Status ─────────────────────────────────────────────────────
// Phase 1 of the consent flow. Called from /checking page on every login.
//
// If the tenant is already in DB → return its consent state immediately.
// If not → create a minimal record using JWT claims only (NO Graph, NO getAccessToken).
//
// WHY no Graph here:
//   getAccessToken(tenant) uses client_credentials flow, which requires the
//   enterprise app SP to exist in the tenant. That SP is only created AFTER the
//   admin completes the Microsoft adminconsent flow. Calling it here would always
//   fail for new tenants with AADSTS700016 / AADSTS65001.
//
// Graph enrichment (real org displayName, email, Dynamics ID) happens in
// consent_Callback AFTER consent, where getAccessToken(tenant) is guaranteed to work.

const check_ConsentStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    console.log("[CONSENT STATUS] ── Incoming request ──────────────────────");
    console.log(`[CONSENT STATUS] tenantId=${tenantId ?? "MISSING"}`);

    if (!tenantId) {
      console.error("[CONSENT STATUS] ❌ tenantId missing — check validateToken middleware");
      return res.status(400).json({ error: "Missing tenantId" });
    }

    // ── Step 1: DB lookup ────────────────────────────────────────────────────
    console.log("[CONSENT STATUS] Step 1 — Querying DB...");
    const result = await client.query(
      `SELECT * FROM public.tenant_get_map_with_entratenantid() WHERE entratenantid = $1`,
      [tenantId],
    );
    let row = result.rows[0] ?? null;
    console.log(`[CONSENT STATUS] Step 1 — row found: ${row !== null}`);

    // ── Step 2: Auto-create from JWT claims (pre-consent) ───────────────────
    if (!row) {
      console.log("[CONSENT STATUS] Step 2 — Tenant not in DB, creating from JWT claims...");
      console.log("[CONSENT STATUS] Step 2 — Using JWT only (Graph unavailable pre-consent, SP doesn't exist yet)");

      // JWT claims decoded by validateToken middleware — always available
      const tenantName  = req.user?.name ?? null;
      const tenantEmail = req.user?.preferred_username ?? null;
      const createdBy   = req.user?.oid ?? null;

      console.log(`[CONSENT STATUS] Step 2 — name=${tenantName} | email=${tenantEmail} | createdBy=${createdBy}`);

      // ── Step 2a: Dynamics lookup — best-effort, non-fatal ─────────────────
      // Dynamics uses its own token (not the tenant's SP), so it works pre-consent
      let dynamicsAccountId = null;
      try {
        console.log("[CONSENT STATUS] Step 2a — Dynamics lookup...");
        const dynamicsToken = await getDynamicsToken();
        const accountRes = await axios.get(
          `${process.env.DYNAMICS_URL}/api/data/v9.2/accounts?$filter=ss_azuretenantid eq '${tenantId}'&$select=accountid&$top=1`,
          {
            headers: {
              Authorization:      `Bearer ${dynamicsToken}`,
              Accept:             "application/json",
              "OData-Version":    "4.0",
              "OData-MaxVersion": "4.0",
            },
            timeout: 8000,
          },
        );
        dynamicsAccountId = accountRes.data.value?.[0]?.accountid ?? null;
        console.log(`[CONSENT STATUS] Step 2a ✅ dynamicsAccountId=${dynamicsAccountId ?? "not found"}`);
      } catch (dynErr) {
        console.warn(`[CONSENT STATUS] Step 2a ⚠️ Dynamics lookup failed (non-fatal): ${dynErr.message}`);
      }

      // ── Step 2b: Insert minimal tenant record ─────────────────────────────
      // isconsented defaults to false in DB — consent_Callback sets it to true later
      try {
        console.log("[CONSENT STATUS] Step 2b — Inserting tenant into DB...");
        await client.query(
          "SELECT public.tenant_create($1, $2, $3, $4, $5, $6, $7) AS tenantuuid",
          [tenantId, tenantName, tenantEmail, createdBy, dynamicsAccountId, null, null],
        );
        console.log(`[CONSENT STATUS] Step 2b ✅ Tenant created — ${tenantId} (${tenantName})`);
      } catch (dbErr) {
        console.error(`[CONSENT STATUS] Step 2b ❌ DB insert failed: ${dbErr.message}`);
        return res.status(500).json({ error: "Failed to register tenant" });
      }

      // ── Step 2c: Re-fetch to confirm and get defaults ─────────────────────
      console.log("[CONSENT STATUS] Step 2c — Re-fetching row after insert...");
      const newResult = await client.query(
        `SELECT * FROM public.tenant_get_map_with_entratenantid() WHERE entratenantid = $1`,
        [tenantId],
      );
      row = newResult.rows[0] ?? null;

      if (!row) {
        console.error("[CONSENT STATUS] Step 2c ❌ Row still missing after insert — DB/RLS issue");
        return res.status(500).json({ error: "Failed to register tenant" });
      }
      console.log("[CONSENT STATUS] Step 2c ✅ Row confirmed in DB");
    }

    // ── Step 3: Return consent state ─────────────────────────────────────────
    // checking.jsx uses this to decide next action:
    //   consented=false + isGlobalAdmin → redirect to MS adminconsent URL
    //   consented=true + isactive + isapproved → redirect to /home
    const consented  = row.isconsented === true;
    const isactive   = row.isactive === true;
    const isapproved = row.isapproved === true;

    console.log(`[CONSENT STATUS] ✅ consented=${consented} | isactive=${isactive} | isapproved=${isapproved}`);
    return res.status(200).json({ consented, isactive, isapproved, tenantId });

  } catch (err) {
    console.error("[CONSENT STATUS] ❌ Unhandled exception:", err.message);
    console.error(err.stack);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── Get Tenant Info ──────────────────────────────────────────────────────────
// Requires the tenant to have already consented — uses getAccessToken(tenantId)
// which needs the enterprise app SP to exist in the tenant.

const get_TenantInfo = async (req, res) => {
  try {
    const tenantId = req.user?.tid || req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Unable to resolve tenantId from access token" });
    }

    const token = await getAccessToken(tenantId);
    const headers = { Authorization: `Bearer ${token}` };

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
      return res.status(404).json({ error: "Tenant organization not found in Microsoft Graph" });
    }

    const defaultDomain = org.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;
    const initialDomain = org.verifiedDomains?.find((d) => d.isInitial)?.name ?? null;

    return res.status(200).json({
      tenantId:                   org.id,
      displayName:                org.displayName,
      defaultDomain,
      initialDomain,
      verifiedDomains:            org.verifiedDomains ?? [],
      createdDateTime:            org.createdDateTime ?? null,
      country:                    org.country ?? null,
      countryLetterCode:          org.countryLetterCode ?? null,
      city:                       org.city ?? null,
      state:                      org.state ?? null,
      street:                     org.street ?? null,
      postalCode:                 org.postalCode ?? null,
      preferredLanguage:          org.preferredLanguage ?? null,
      tenantType:                 org.tenantType ?? null,
      onPremisesSyncEnabled:      org.onPremisesSyncEnabled ?? null,
      onPremisesLastSyncDateTime: org.onPremisesLastSyncDateTime ?? null,
      technicalNotificationMails: org.technicalNotificationMails ?? [],
      defaultUsageLocation:       org.defaultUsageLocation ?? null,
      directorySizeQuota:         org.directorySizeQuota ?? null,
      assignedPlans:              org.assignedPlans ?? [],
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


// ─── Get Graph Org Info ───────────────────────────────────────────────────────
// Returns displayName, default domain, and technical notification email
// for the calling tenant. Requires a post-consent token (enterprise app SP
// must already exist in the tenant).

const get_GraphOrgInfo = async (req, res) => {
  try {
    const tenantId = req.user?.tid || req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Unable to resolve tenantId from access token" });
    }

    const token   = await getAccessToken(tenantId);
    const headers = { Authorization: `Bearer ${token}` };

    const orgRes = await axios.get(`${GRAPH_URL}/organization`, {
      headers,
      params: {
        $select: "displayName,verifiedDomains,technicalNotificationMails",
      },
      timeout: 10000,
    });

    const org = orgRes.data.value?.[0];

    if (!org) {
      return res.status(404).json({ error: "Tenant organization not found in Microsoft Graph" });
    }

    return res.status(200).json({
      displayName:  org.displayName ?? null,
      defaultDomain: org.verifiedDomains?.find((d) => d.isDefault)?.name ?? null,
      email:         org.technicalNotificationMails?.[0] ?? null,
    });
  } catch (err) {
    console.error("get_GraphOrgInfo error:", err.message);

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
   get_GraphOrgInfo,
};