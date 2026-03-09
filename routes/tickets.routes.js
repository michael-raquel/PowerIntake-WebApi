const express = require("express");
const router = express.Router();
const {create_Ticket} = require("../controllers/tickets.controllers");
const validateToken = require("../middlewares/validateToken");

router.post("/", create_Ticket);

module.exports = router;
