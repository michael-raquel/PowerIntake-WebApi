const express = require('express');
const router = express.Router();
const { get_AllUsers, get_UserById, get_UserManager, get_UserDirectReports,
        get_UserFullProfile, get_AllUsersWithDetails, get_UserGroups, get_UserAppRoleAssignments, get_UserFromDb, get_User_Info, get_User_Role,
        update_UserRole, sync_Users, create_user_onlogin } = require('../controllers/users.controllers');
const validateToken = require("../middlewares/validateToken");

router.get('/', get_AllUsers);
router.get('/profile', validateToken, get_UserById);
router.get('/manager', validateToken, get_UserManager);
router.get('/direct-reports', validateToken, get_UserDirectReports);
router.get('/full-profile', validateToken, get_UserFullProfile);
router.get('/all-users-with-details', validateToken, get_AllUsersWithDetails);
router.get('/groups', validateToken, get_UserGroups);
router.get('/app-role-assignments', validateToken, get_UserAppRoleAssignments);
router.get('/db', validateToken, get_UserFromDb);
router.get('/user-info', get_User_Info);
router.get('/role', get_User_Role);
router.put('/role', validateToken, update_UserRole);
router.post('/sync', sync_Users);
router.post("/login-sync", validateToken, create_user_onlogin);

module.exports = router;