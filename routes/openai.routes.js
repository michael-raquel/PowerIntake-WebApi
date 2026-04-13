const express = require("express");
const router = express.Router();

const { getAIResponse } = require("../controllers/openai.controllers");

router.post("/response", getAIResponse);

module.exports = router;