const express = require("express");
const router = express.Router();
const {create_Ticket, get_Ticket, update_Ticket} = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Ticket);
router.post("/", validateToken, create_Ticket);
router.put("/", validateToken, update_Ticket);

module.exports = router;
