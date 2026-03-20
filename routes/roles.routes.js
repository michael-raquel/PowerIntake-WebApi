const express = require('express');
const router = express.Router();
const {
  get_AppRoleAssignments,
  create_AppRoleAssignment,
  delete_AppRoleAssignment,
  get_AppRoleAssignment,
} = require('../controllers/roles.controllers');
const validateToken = require("../middlewares/validateToken");
// GET ?principalId=...&principalType=users|groups|servicePrincipals
router.get('/app-role-assignments', validateToken, get_AppRoleAssignments);

// POST body: { principalId, resourceId, appRoleId, principalType? }
router.post('/app-role-assignments', validateToken, create_AppRoleAssignment);

// DELETE /roles/app-role-assignments/:principalId/:assignmentId?principalType=...
router.delete('/app-role-assignments/:principalId/:assignmentId', validateToken, delete_AppRoleAssignment);

router.get('/app-role-assignment', validateToken, get_AppRoleAssignment);

module.exports = router;