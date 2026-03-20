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

router.get("/", get_AllGroups);
router.get("/find", get_GroupById);
router.get("/members", get_GroupMembers);
router.get("/owners", get_GroupOwners);
router.get("/profile", get_GroupFullProfile);
router.get("/with-members", get_AllGroupsWithMembers);
router.post("/assign", validateToken, assign_UserToGroup);
router.delete("/unassign", validateToken, unassign_UserFromGroup);
router.get("/app-roles/:appId", getAppRolesByAppRegistration);
router.get("/user-groups/:userOid/:clientId", getUserGroupsByAppRole);
router.get("/app-roles-with-groups/:clientId", getAppRolesWithGroupsByClientId);

module.exports = router;
