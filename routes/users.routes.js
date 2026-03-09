const express = require('express');
const router = express.Router();
const { get_AllUsers,get_UserById, get_UserManager, get_UserDirectReports, 
        get_UserFullProfile, get_AllUsersWithDetails, get_UserGroups} = require('../controllers/users.controllers');

router.get('/', get_AllUsers);
router.get('/profile', get_UserById);
router.get('/manager', get_UserManager);
router.get('/direct-reports', get_UserDirectReports);
router.get('/full-profile', get_UserFullProfile);
router.get('/all-users-with-details', get_AllUsersWithDetails);
router.get('/groups', get_UserGroups);

module.exports = router;