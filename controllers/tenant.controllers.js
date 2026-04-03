const client = require("../config/db");

const create_Tenant = async (req, res) => {
  try {
    const {
      entratenantid,
      tenantname,
      tenantemail,
      createdby,
      dynamicsaccountid,
      superadmingroupid,
      admingroupid,
      companyallgroupid,
    } = req.body;

    const finalTenantId = entratenantid || null;
    const finalCreatedBy = createdby || req.user?.oid || null;

    if (!finalTenantId || !tenantname) {
      return res.status(400).json({
        error: "entratenantid and tenantname are required",
      });
    }

    const result = await client.query(
      "SELECT public.tenant_create($1, $2, $3, $4, $5, $6, $7, $8) AS tenantuuid",
      [
        finalTenantId,
        tenantname,
        tenantemail || null,
        finalCreatedBy || null,
        dynamicsaccountid || null,
        superadmingroupid || null,
        admingroupid || null,
        companyallgroupid || null,
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

const get_Tenants = async (req, res) => {
  try {
    const {
      tenantid,
      entratenantid,
      dynamicsaccountid,
      isconsented,
      isactive,
    } = req.query;

    const parseBool = (value, key) => {
      if (value === undefined || value === null || value === "") return null;
      if (value === "true") return true;
      if (value === "false") return false;
      throw new Error(`VALIDATION_ERROR: ${key} must be true or false`);
    };

    const parsedTenantId =
      tenantid === undefined || tenantid === null || tenantid === ""
        ? null
        : Number(tenantid);

    if (parsedTenantId !== null && Number.isNaN(parsedTenantId)) {
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
        parseBool(isconsented, "isconsented"),
        parseBool(isactive, "isactive"),
      ],
    );

    return res.status(200).json(result.rows);
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
    const isactive = tenantExists ? row.isactive === true : false;

    console.log(
      `[CONSENT STATUS] tenantId=${tenantId} tenantExists=${tenantExists} consented=${consented} isactive=${isactive}`
    );

    return res.status(200).json({
      tenantExists,
      consented,
      isactive,
      tenantId,
    });

  } catch (err) {
    console.error("[CONSENT STATUS ERROR]", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { create_Tenant, get_Tenants, check_ConsentStatus };
