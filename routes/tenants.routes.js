const express = require("express");
const router = express.Router();
const {
  create_Tenant,
  get_Tenants,
} = require("../controllers/tenant.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Tenants);
router.post("/", validateToken, create_Tenant);

module.exports = router;
