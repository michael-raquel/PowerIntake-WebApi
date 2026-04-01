const express = require("express");
const router = express.Router();
const { get_technician } = require("../controllers/technician.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_technician);

module.exports = router;