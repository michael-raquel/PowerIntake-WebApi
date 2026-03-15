const express = require('express');
const router = express.Router();
const {get_user_from_my_company, get_user_from_my_team, manager_check} = require('../controllers/manageusers.controllers');

router.get('/mycompany', get_user_from_my_company);
router.get('/myteam', get_user_from_my_team);
router.get('/managercheck', manager_check);

module.exports = router;