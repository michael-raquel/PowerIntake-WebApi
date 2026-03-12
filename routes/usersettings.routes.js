const express = require("express");
const router = express.Router();
const {get_UserSettings, create_UserSettings, update_UserSettings} = require("../controllers/usersettings.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_UserSettings);
router.post("/", create_UserSettings);
router.put("/", update_UserSettings);

module.exports = router;
