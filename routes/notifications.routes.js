const express = require("express");
const router = express.Router();
const validateToken = require("../middlewares/validateToken");
const {
    get_Notification,
    create_Notification,
    delete_Notification,
    markIsRead_Notification,
} = require("../controllers/notifications.controllers");

router.get("/", validateToken, get_Notification);
router.post("/", validateToken, create_Notification);
router.patch("/isread", validateToken, markIsRead_Notification);
router.delete("/", validateToken, delete_Notification);

module.exports = router;