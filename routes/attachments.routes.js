const express = require("express");
const router = express.Router();
const {get_Attachment, create_Attachment, update_Attachment} = require("../controllers/attachments.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken,  get_Attachment);
router.post("/", validateToken, create_Attachment);
router.put("/", validateToken,  update_Attachment);

module.exports = router;
