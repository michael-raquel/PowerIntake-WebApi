const express = require("express");
const router = express.Router();
const {
	get_PowerSuiteAILogs,
	create_PowerSuiteAILogs,
	delete_PowerSuiteAILogs,
	update_PowerSuiteAILogs_TicketId,
} = require("../controllers/powersuiteailogs.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_PowerSuiteAILogs);
router.post("/", validateToken, create_PowerSuiteAILogs);
router.patch("/", validateToken, update_PowerSuiteAILogs_TicketId);
router.delete("/:powersuiteailogsuuid", validateToken, delete_PowerSuiteAILogs);

module.exports = router;
