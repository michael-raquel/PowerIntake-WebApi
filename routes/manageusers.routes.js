const express = require('express');
const router = express.Router();
const {get_user_from_my_company, get_user_from_my_team, get_user_super_admin, get_user_my_clients, manager_check} = require('../controllers/manageusers.controllers');
const validateToken = require("../middlewares/validateToken");
router.get('/mycompany', validateToken, get_user_from_my_company);
router.get('/myteam', validateToken, get_user_from_my_team);
router.get('/superadmin', validateToken, get_user_super_admin);
router.get('/myclients', validateToken, get_user_my_clients);
router.get('/managercheck', validateToken, manager_check);

module.exports = router;