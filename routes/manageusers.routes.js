const express = require('express');
const router = express.Router();
const {get_user_from_my_company, get_user_from_my_team, get_user_super_admin, get_user_my_clients, manager_check} = require('../controllers/manageusers.controllers');

router.get('/mycompany', get_user_from_my_company);
router.get('/myteam', get_user_from_my_team);
router.get('/superadmin', get_user_super_admin);
router.get('/myclients', get_user_my_clients);
router.get('/managercheck', manager_check);

module.exports = router;