const APP_ROLE_MAP = {
  "154626a2-3572-4da2-9b85-050ff2f833d8": "User",
  "760d8415-aef1-4e8d-929d-a37aeb76c90f": "Manager",
  "3d316243-5776-4d70-93e0-0762378f97ed": "Admin",
  "7c00a0df-14b7-47e9-99d0-b3a06cc05e49": "SuperAdmin",
};

const resolveRoleName = (appRoleId) => {
  return APP_ROLE_MAP[appRoleId] ?? null;
};

module.exports = { APP_ROLE_MAP, resolveRoleName };