const express = require("express");
const router = express.Router();
const { upload, upload_Image, delete_Image, download_Image } = require("../controllers/images.controllers");
const validateToken = require("../middlewares/validateToken");
router.post("/upload", validateToken, upload.single("image"), upload_Image);
router.delete("/upload/:blobName", validateToken, delete_Image);
router.get("/download/:blobName", validateToken, download_Image); 

module.exports = router;