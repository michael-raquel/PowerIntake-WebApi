const express = require('express');
const router = express.Router();
const {
  get_AllGroups,
  get_GroupById,
  get_GroupMembers,
  get_GroupOwners,
  get_GroupFullProfile,
  get_AllGroupsWithMembers,
} = require('../controllers/groups.controllers');

router.get('/', get_AllGroups);
router.get('/find', get_GroupById);
router.get('/members', get_GroupMembers);
router.get('/owners', get_GroupOwners);
router.get('/profile', get_GroupFullProfile);
router.get('/with-members', get_AllGroupsWithMembers);

module.exports = router;