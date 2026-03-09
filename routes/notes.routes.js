const express = require("express");
const router = express.Router();
const { get_Note, create_Note, update_Note } = require("../controllers/notes.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", validateToken, get_Note);
router.post("/", validateToken, create_Note);
router.put("/:noteuuid", validateToken, update_Note);

module.exports = router;