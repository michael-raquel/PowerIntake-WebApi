const express = require("express");
const router = express.Router();
const {get_UserSettings, create_UserSettings, update_UserSettings, update_UserSettings_RecordCounts, update_UserSettings_HideCompletedTickets} = require("../controllers/usersettings.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_UserSettings);
router.post("/",  create_UserSettings);
router.put("/", update_UserSettings);
router.patch("/record-counts", update_UserSettings_RecordCounts);
router.patch("/hide-completed-tickets", update_UserSettings_HideCompletedTickets);

module.exports = router;
