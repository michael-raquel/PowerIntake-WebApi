const express = require("express");
const router = express.Router();
const { get_Note, create_Note, update_Note } = require("../controllers/notes.controllers");
const validateToken = require("../middlewares/validateToken");

router.get("/", get_Note);
router.post("/", create_Note);
router.put("/:noteuuid", update_Note);

module.exports = router;