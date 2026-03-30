const client = require("../config/db");

const check_ConsentStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId; // from validateToken middleware
    console.log("[CONSENT STATUS] Checking for tenantId:", tenantId);

    const result = await client.query(
      `SELECT * FROM public.tenant_get_map_with_entratenantid()
       WHERE entratenantid = $1`,
      [tenantId]
    );

    const tenantExists = result.rows.length > 0;
    const row = result.rows[0] ?? null;

    // ✅ Use isconsented column instead
    const consented = tenantExists ? row.isconsented === true : false;

    console.log(
      `[CONSENT STATUS] tenantId=${tenantId} tenantExists=${tenantExists} consented=${consented}`
    );

    return res.status(200).json({
      tenantExists,
      consented,
      tenantId,
    });

  } catch (err) {
    console.error("[CONSENT STATUS ERROR]", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { check_ConsentStatus };