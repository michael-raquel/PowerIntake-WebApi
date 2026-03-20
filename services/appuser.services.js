const { APP_ROLE_MAP } = require("../config/groupRoleMap");

function getUserAppRolesFromToken(tokenPayload) {
  if (!tokenPayload) return [];

  const appRoleIds = Array.isArray(tokenPayload.roles)
    ? tokenPayload.roles
    : [];

  const roleNames = new Set();

  for (const roleId of appRoleIds) {
    const mapped = APP_ROLE_MAP[roleId];
    if (mapped) {
      roleNames.add(mapped);
    }
  }

  return Array.from(roleNames);
}

function userHasAnyRole(tokenPayload, allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return false;
  }

  const userRoles = getUserAppRolesFromToken(tokenPayload);
  return userRoles.some((r) => allowedRoles.includes(r));
}

module.exports = {
  getUserAppRolesFromToken,
  userHasAnyRole,
};
