const express = require('express');
const router = express.Router();
const {get_user_from_my_company} = require('../controllers/manageusers.controllers');

router.get('/mycompany', get_user_from_my_company);

module.exports = router;