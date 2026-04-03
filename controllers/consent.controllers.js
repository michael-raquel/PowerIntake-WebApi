const axios = require("axios");
const client = require("../config/db");
const { getAccessToken } = require("../config/authService");

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
    const orgRes = await axios.get("https://graph.microsoft.com/v1.0/organization", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const org          = orgRes.data.value?.[0];
    const tenantName   = org?.displayName ?? "Unknown";
    const tenantDomain = org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;

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
