const express = require("express");
const router  = express.Router();
const { consent_Callback }   = require("../controllers/consent.controllers");
const { check_ConsentStatus } = require("../controllers/tenant.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/consent-callback",  consent_Callback);
router.get("/consent-status", validateToken, check_ConsentStatus);

module.exports = router;