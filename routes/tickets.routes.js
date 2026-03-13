const express = require("express");
const router = express.Router();
const { get_Ticket, get_Ticket_Status, get_ManagerTeamTickets, create_Ticket, update_Ticket} = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_Ticket);
router.get("/status",  get_Ticket_Status);
router.get("/manager-team", get_ManagerTeamTickets);
router.post("/", create_Ticket);
router.put("/",  update_Ticket);

module.exports = router;
 