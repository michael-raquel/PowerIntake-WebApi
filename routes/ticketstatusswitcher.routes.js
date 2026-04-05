const express = require("express");
const router = express.Router();
const { cancel_DynamicsTicket, resolve_DynamicsTicket } = require("../controllers/ticketstatusswitcher");

router.post("/cancel", cancel_DynamicsTicket);
router.post("/resolve", resolve_DynamicsTicket);
// router.post("/reactivate", reactivate_DynamicsTicket);

module.exports = router;