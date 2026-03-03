const express = require("express");
const router = express.Router();
const {get_SystemAdmin, create_SystemAdmin, update_SystemAdmin} = require("../controllers/systemadmin.controllers");

router.get("/", get_SystemAdmin);
router.post("/", create_SystemAdmin);
router.put("/", update_SystemAdmin);

module.exports = router;