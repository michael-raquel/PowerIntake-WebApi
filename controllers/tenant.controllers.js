const client = require("../config/db");

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
    const tenantId = req.tenantId; // from validateToken middleware
    console.log("[CONSENT STATUS] Checking for tenantId:", tenantId);

    const result = await client.query(
      `SELECT * FROM public.tenant_get_map_with_entratenantid()
       WHERE entratenantid = $1`,
      [tenantId],
    );

    const tenantExists = result.rows.length > 0;
    const row = result.rows[0] ?? null;

    // ✅ Use isconsented column instead
    const consented = tenantExists ? row.isconsented === true : false;
    const isactive = tenantExists ? row.isactive === true : false;

    console.log(
      `[CONSENT STATUS] tenantId=${tenantId} tenantExists=${tenantExists} consented=${consented} isactive=${isactive}`,
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

module.exports = {
  create_Tenant,
  update_Tenant,
  get_Tenants,
  check_ConsentStatus,
};
