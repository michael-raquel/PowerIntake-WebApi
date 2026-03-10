const express = require("express");
const router = express.Router();
const {create_Ticket, get_Tickets} = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Tickets);
router.post("/", validateToken, create_Ticket);

module.exports = router;
