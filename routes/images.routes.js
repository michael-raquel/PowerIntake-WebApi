const express = require("express");
const router = express.Router();
const { upload, upload_Image, delete_Image } = require("../controllers/images.controllers");

router.post("/upload", upload.single("image"), upload_Image);
router.delete("/upload/:blobName", delete_Image);

module.exports = router;