const express = require("express");
const router = express.Router();
const { get_Ticket, get_Ticket_Status, get_ManagerTeamTickets, get_ManagerTickets, create_Ticket, 
    update_Ticket, get_DynamicsTickets, get_DynamicsTicketById, sync_DynamicsTickets_toDB, sync_DynamicsTickets_toDB_auto,
    webhook_DynamicsTicketUpdate, webhook_DynamicsTicketDelete } = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Ticket);
router.get("/status",   validateToken, get_Ticket_Status);
router.get("/manager-team", validateToken, get_ManagerTeamTickets);
router.get("/manager", validateToken, get_ManagerTickets);
router.post("/", validateToken, create_Ticket);
router.put("/",  validateToken, update_Ticket);

//Dont put validate token on these routes, okie?
router.get("/dynamics", get_DynamicsTickets);
router.get("/dynamics/:ticketnumber", get_DynamicsTicketById);
router.post("/sync-dynamics", sync_DynamicsTickets_toDB);
router.post("/auto-sync-dynamics", sync_DynamicsTickets_toDB_auto);
router.post('/dynamics/ticket-update', webhook_DynamicsTicketUpdate);
router.post('/dynamics/ticket-delete', webhook_DynamicsTicketDelete);

module.exports = router;
 