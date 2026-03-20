const express = require("express");
const router = express.Router();
const {get_Attachment, create_Attachment, update_Attachment} = require("../controllers/attachments.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/",  get_Attachment);
router.post("/", create_Attachment);
router.put("/",  update_Attachment);

module.exports = router;
