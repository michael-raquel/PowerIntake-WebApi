const express = require('express');
const router = express.Router();
const { get_AllUsers,get_UserById, get_UserManager, get_UserDirectReports, get_UserFullProfile} = require('../controllers/users.controllers');

router.get('/', get_AllUsers);
router.get('/profile', get_UserById);
router.get('/manager', get_UserManager);
router.get('/direct-reports', get_UserDirectReports);
router.get('/full-profile', get_UserFullProfile);

module.exports = router;