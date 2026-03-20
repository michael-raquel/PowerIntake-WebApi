const express = require("express");
const router = express.Router();
const {get_UserSettings, create_UserSettings, update_UserSettings} = require("../controllers/usersettings.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_UserSettings);
router.post("/", validateToken, create_UserSettings);
router.put("/", validateToken, update_UserSettings);

module.exports = router;
