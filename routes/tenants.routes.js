const express = require("express");
const router = express.Router();
const {
  create_Tenant,
  update_Tenant,
  get_Tenants,
  check_ConsentStatus,
  get_TenantInfo,
  get_GraphOrgInfo,
} = require("../controllers/tenant.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_Tenants);
router.post("/", validateToken, create_Tenant);
router.put("/", update_Tenant);
router.get("/consent/status", validateToken, check_ConsentStatus);
router.get("/tenant/info", validateToken, get_TenantInfo);
router.get("/tenant/org", validateToken, get_GraphOrgInfo);

module.exports = router;