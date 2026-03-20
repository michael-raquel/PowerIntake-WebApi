const express = require("express");
const router = express.Router();
const validateToken = require("../middlewares/validateToken");
const {
  get_AllGroups,
  get_GroupById,
  get_GroupMembers,
  get_GroupOwners,
  get_GroupFullProfile,
  get_AllGroupsWithMembers,
  assign_UserToGroup,
  unassign_UserFromGroup,
  getAppRolesByAppRegistration,
  getUserGroupsByAppRole,
  getAppRolesWithGroupsByClientId,
} = require("../controllers/groups.controllers");

router.get("/", validateToken, get_AllGroups);
router.get("/find", validateToken, get_GroupById);
router.get("/members", validateToken, get_GroupMembers);
router.get("/owners", validateToken, get_GroupOwners);
router.get("/profile", validateToken, get_GroupFullProfile);
router.get("/with-members", validateToken, get_AllGroupsWithMembers);
router.post("/assign", validateToken, assign_UserToGroup);
router.delete("/unassign", validateToken, unassign_UserFromGroup);
router.get("/app-roles/:appId", validateToken, getAppRolesByAppRegistration);
router.get("/user-groups/:userOid/:clientId", validateToken, getUserGroupsByAppRole);
router.get("/app-roles-with-groups/:clientId", validateToken, getAppRolesWithGroupsByClientId);

module.exports = router;
