const axios = require("axios");
const client = require("../config/db");
const { getAccessToken } = require("../config/authService");

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Microsoft Graph App ID (constant across all tenants)
const GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000";

// The Graph application permissions your app needs
const REQUIRED_GRAPH_ROLES = [
  "62a82d76-70ea-41e2-9197-370581804d09", // Group.ReadWrite.All
  "dbaae8cf-10b5-4b86-a4a1-f871c94c6695", // GroupMember.ReadWrite.All
  "df021288-bdef-4463-88db-98f22de89214", // User.Read.All
  "5b567255-7703-4780-807c-7be8301ae99b", // Group.Read.All (optional, for listing)
];

const grantGraphPermissions = async (token, tenantId) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Step 1: Get your app's service principal on the client tenant
  const ourSpRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${process.env.AZURE_CLIENT_ID}'&$select=id,appId,displayName`,
    { headers }
  );
  const ourSp = ourSpRes.data.value?.[0];
  if (!ourSp) throw new Error("Our service principal not found on client tenant");

  // Step 2: Get Microsoft Graph service principal on the client tenant
  const graphSpRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${GRAPH_APP_ID}'&$select=id,appRoles`,
    { headers }
  );
  const graphSp = graphSpRes.data.value?.[0];
  if (!graphSp) throw new Error("Microsoft Graph service principal not found");

  // Step 3: Get already granted app role assignments to avoid duplicates
  const existingRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals/${ourSp.id}/appRoleAssignments`,
    { headers }
  );
  const existingRoleIds = new Set(
    existingRes.data.value.map((a) => a.appRoleId)
  );

  // Step 4: Grant each missing permission
  const results = await Promise.allSettled(
    REQUIRED_GRAPH_ROLES
      .filter((roleId) => !existingRoleIds.has(roleId))
      .map((appRoleId) =>
        axios.post(
          `${GRAPH_URL}/servicePrincipals/${ourSp.id}/appRoleAssignments`,
          {
            principalId: ourSp.id,
            resourceId:  graphSp.id,
            appRoleId,
          },
          { headers }
        )
      )
  );

  const granted  = results.filter((r) => r.status === "fulfilled").length;
  const skipped  = existingRoleIds.size;
  const failed   = results.filter((r) => r.status === "rejected");

  failed.forEach((f) =>
    console.warn("[CONSENT] Permission grant failed:", f.reason?.response?.data?.error?.message ?? f.reason?.message)
  );

  console.log(`[CONSENT] Graph permissions — granted: ${granted}, already existed: ${skipped}, failed: ${failed.length}`);
};

const consent_Callback = async (req, res) => {
  const { tenant, admin_consent, error } = req.query;

  if (error || admin_consent !== "True") {
    console.warn("[CONSENT] Failed or cancelled:", { tenant, error, admin_consent });
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  if (!tenant) {
    console.error("[CONSENT] Missing tenant in callback");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  try {
    const token  = await getAccessToken(tenant);
    const orgRes = await axios.get(`${GRAPH_URL}/organization`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const org          = orgRes.data.value?.[0];
    const tenantName   = org?.displayName ?? "Unknown";
    const tenantDomain = org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;

    // ── Grant Graph permissions on client tenant ──────────
    try {
      await grantGraphPermissions(token, tenant);
    } catch (grantErr) {
      // Non-fatal — log and continue, DB update still happens
      console.warn("[CONSENT] Could not auto-grant Graph permissions:", grantErr.message);
    }

    const consentResult = await client.query(
      `SELECT * FROM public.tenant_update_isconsented($1, $2)`,
      [tenant, true]
    );

    const updateRow = consentResult.rows[0];

    if (!updateRow?.updated) {
      console.error(`[CONSENT] ❌ Tenant not found in DB — tenant=${tenant} name=${tenantName}`);
      return res.json({ redirectUrl: "/consent-callback?consent=failed" });
    }

    console.log("[CONSENT] ✅ Admin approval received:");
    console.log(`  Tenant ID   : ${tenant}`);
    console.log(`  Tenant Name : ${tenantName}`);
    console.log(`  Domain      : ${tenantDomain}`);
    console.log(`  DB updated  : ${updateRow.updated}`);
    console.log(`  Timestamp   : ${new Date().toISOString()}`);

    return res.json({ redirectUrl: "/consent-callback?consent=success" });

  } catch (err) {
    console.error("[CONSENT] Callback error:", err.message);
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
};

module.exports = { consent_Callback };