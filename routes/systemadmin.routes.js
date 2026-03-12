const express = require("express");
const router = express.Router();
const {get_SystemAdmin, create_SystemAdmin, update_SystemAdmin} = require("../controllers/systemadmin.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_SystemAdmin);
router.post("/", create_SystemAdmin);
router.put("/:systemadminuuid", update_SystemAdmin);

module.exports = router;