const express = require('express');
const router = express.Router();
const {
  get_AppRoleAssignments,
  create_AppRoleAssignment,
  delete_AppRoleAssignment,
  get_AppRoleAssignment,
} = require('../controllers/roles.controllers');

// GET ?principalId=...&principalType=users|groups|servicePrincipals
router.get('/app-role-assignments', get_AppRoleAssignments);

// POST body: { principalId, resourceId, appRoleId, principalType? }
router.post('/app-role-assignments', create_AppRoleAssignment);

// DELETE /roles/app-role-assignments/:principalId/:assignmentId?principalType=...
router.delete('/app-role-assignments/:principalId/:assignmentId', delete_AppRoleAssignment);

router.get('/app-role-assignment', get_AppRoleAssignment);

module.exports = router;