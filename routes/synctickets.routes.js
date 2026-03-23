const express = require('express');
const router = express.Router();
const { 
    sync_DynamicsTickets_byClients,
    sync_DynamicsTickets_byCompany,
    sync_DynamicsTickets_byTeam,
    sync_DynamicsTickets_byUser 
} = require("../controllers/synctickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.post("/clients", sync_DynamicsTickets_byClients);
router.post("/company", sync_DynamicsTickets_byCompany);
router.post("/team", sync_DynamicsTickets_byTeam);
router.post("/user", sync_DynamicsTickets_byUser);

module.exports = router;
 
