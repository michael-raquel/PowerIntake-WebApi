const express = require("express");
const router = express.Router();
const {getSystemAdmin} = require("../controllers/systemadmin.controllers");

router.get("/", getSystemAdmin);

module.exports = router;