const express = require("express");
const router = express.Router();
const { get_Ticket, get_Ticket_Status, get_ManagerTeamTickets, get_ManagerTickets, create_Ticket, 
    update_Ticket, get_DynamicsTickets, get_DynamicsTicketById, sync_DynamicsTickets_toDB } = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Ticket);
router.get("/status",   validateToken, get_Ticket_Status);
router.get("/manager-team", validateToken, get_ManagerTeamTickets);
router.get("/manager", validateToken, get_ManagerTickets);
router.post("/", validateToken, create_Ticket);
router.put("/",  validateToken, update_Ticket);
router.get("/dynamics", get_DynamicsTickets);
router.get("/dynamics/:ticketnumber", get_DynamicsTicketById);
router.post("/sync-dynamics", validateToken, sync_DynamicsTickets_toDB);

module.exports = router;
 