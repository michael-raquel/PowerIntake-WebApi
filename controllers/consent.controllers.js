const axios = require("axios");
const client = require("../config/db");
const { getAccessToken } = require("../config/authService");

const consent_Callback = async (req, res) => {
  const { tenant, admin_consent, error } = req.query;

  // ❌ If failed → DO NOT call SP
  if (error || admin_consent !== "True") {
    console.log("[CONSENT] Failed or cancelled:", {
      tenant,
      error,
      admin_consent,
    });
    return res.redirect("https://powerintake.spartaserv.com?consent=failed");
  }

  try {
    const token = await getAccessToken(tenant);
    const headers = { Authorization: `Bearer ${token}` };

    // ── Fetch org info ─────────────────────────────
    const orgRes = await axios.get(
      "https://graph.microsoft.com/v1.0/organization",
      { headers },
    );

    const org = orgRes.data.value?.[0];
    const tenantName = org?.displayName ?? "Unknown";
    const tenantEmail =
      org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;

    // ── Ensure tenant exists ───────────────────────
    await client.query(`SELECT public.batch_tenant_insert($1, $2, $3)`, [
      [tenantName],
      [null],
      [tenant],
    ]);

    // ── ✅ Call SP with result handling ─────────────
    const consentResult = await client.query(
      `SELECT * FROM public.tenant_update_isconsented($1, $2)`,
      [tenant, true],
    );

    const updateRow = consentResult.rows[0];

    if (!updateRow?.updated) {
      throw new Error("Failed to update consent status");
    }

    console.log("[CONSENT] DB update:", updateRow);
    console.log(`[CONSENT] Tenant consented: ${tenantName} (${tenant})`);

    // ── Redirect success ───────────────────────────
    return res.redirect("https://powerintake.spartaserv.com?consent=success");
  } catch (err) {
    console.error("[CONSENT] Callback error:", err.message);

    return res.redirect("https://powerintake.spartaserv.com?consent=failed");
  }
};

module.exports = { consent_Callback };
