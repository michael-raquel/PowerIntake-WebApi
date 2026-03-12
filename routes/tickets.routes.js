const express = require("express");
const router = express.Router();
const { get_Ticket, get_Ticket_Status, create_Ticket, update_Ticket} = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Ticket);
router.get("/status", validateToken, get_Ticket_Status);
router.post("/", validateToken, create_Ticket);
router.put("/", validateToken, update_Ticket);

module.exports = router;
 