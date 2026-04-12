const axios = require("axios");
const { getAccessToken } = require("../config/authService");

const GRAPH_URL = "https://graph.microsoft.com/v1.0";

const GROUP_FIELDS = [
  "id",
  "displayName",
  "description",
  "mail",
  "mailEnabled",
  "securityEnabled",
  "groupTypes",
  "membershipRule",
  "membershipRuleProcessingState",
  "createdDateTime",
  "visibility",
  "classification",
].join(",");

const get_AllGroups = async (req, res) => {
  try {
    const token = await getAccessToken(req.tenantId);
    let groups = [];
    let url = `${GRAPH_URL}/groups`;

    while (url) {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params:
          url === `${GRAPH_URL}/groups`
            ? { $select: GROUP_FIELDS, $top: 999 }
            : {},
        timeout: 10000,
      });

      groups = [...groups, ...response.data.value];
      url = response.data["@odata.nextLink"] || null;
    }

    return res.status(200).json({
      count: groups.length,
      groups,
    });
  } catch (err) {
    console.error("get_AllGroups error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const get_GroupById = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/groups/${id}`, {
      headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` },
      params: { $select: GROUP_FIELDS },
    });

    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    res
      .status(status)
      .send(status === 404 ? "Group not found" : "Internal Server Error");
  }
};

const get_GroupMembers = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/groups/${id}/members`, {
      headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` },
      params: {
        $select: "id,displayName,mail,userPrincipalName,jobTitle",
        $top: 999,
      },
    });

    res.status(200).json({
      count: response.data.value.length,
      members: response.data.value,
    });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

const get_GroupOwners = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/groups/${id}/owners`, {
      headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` },
      params: { $select: "id,displayName,mail,userPrincipalName" },
    });

    res.status(200).json({
      count: response.data.value.length,
      owners: response.data.value,
    });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

const get_GroupFullProfile = async (req, res) => {
  try {
    const { id } = req.query;
    const token = await getAccessToken(req.tenantId);
    const headers = { Authorization: `Bearer ${token}` };

    const [groupRes, membersRes, ownersRes] = await Promise.allSettled([
      axios.get(`${GRAPH_URL}/groups/${id}`, {
        headers,
        params: { $select: GROUP_FIELDS },
      }),
      axios.get(`${GRAPH_URL}/groups/${id}/members`, {
        headers,
        params: {
          $select: "id,displayName,mail,userPrincipalName,jobTitle",
          $top: 999,
        },
      }),
      axios.get(`${GRAPH_URL}/groups/${id}/owners`, {
        headers,
        params: { $select: "id,displayName,mail,userPrincipalName" },
      }),
    ]);

    res.status(200).json({
      group: groupRes.status === "fulfilled" ? groupRes.value.data : null,
      members:
        membersRes.status === "fulfilled" ? membersRes.value.data.value : [],
      owners:
        ownersRes.status === "fulfilled" ? ownersRes.value.data.value : [],
    });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

const get_AllGroupsWithMembers = async (req, res) => {
  try {
    const token = await getAccessToken(req.tenantId);
    const headers = { Authorization: `Bearer ${token}` };

    let groups = [];
    let url = `${GRAPH_URL}/groups`;

    while (url) {
      const response = await axios.get(url, {
        headers,
        params:
          url === `${GRAPH_URL}/groups`
            ? { $select: GROUP_FIELDS, $top: 999 }
            : {},
        timeout: 10000,
      });
      groups = [...groups, ...response.data.value];
      url = response.data["@odata.nextLink"] || null;
    }

    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const [membersRes, ownersRes] = await Promise.allSettled([
          axios.get(`${GRAPH_URL}/groups/${group.id}/members`, {
            headers,
            params: {
              $select:
                "id,displayName,mail,userPrincipalName,jobTitle,department",
              $top: 999,
            },
          }),
          axios.get(`${GRAPH_URL}/groups/${group.id}/owners`, {
            headers,
            params: { $select: "id,displayName,mail,userPrincipalName" },
          }),
        ]);

        return {
          ...group,
          members:
            membersRes.status === "fulfilled"
              ? membersRes.value.data.value
              : [],
          owners:
            ownersRes.status === "fulfilled" ? ownersRes.value.data.value : [],
          memberCount:
            membersRes.status === "fulfilled"
              ? membersRes.value.data.value.length
              : 0,
        };
      }),
    );

    return res.status(200).json({
      count: enrichedGroups.length,
      groups: enrichedGroups,
    });
  } catch (err) {
    console.error("get_AllGroupsWithMembers error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const assign_UserToGroup = async (req, res) => {
  try {
    const { userOid, groupId } = req.body || {};

    if (!userOid || !groupId) {
      return res
        .status(400)
        .json({ error: "userOid and groupId are required" });
    }

    const token = await getAccessToken(req.tenantId);

    await axios.post(
      `${GRAPH_URL}/groups/${groupId}/members/$ref`,
      {
        "@odata.id": `${GRAPH_URL}/directoryObjects/${userOid}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("assign_UserToGroup error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const unassign_UserFromGroup = async (req, res) => {
  try {
    const { userOid, groupId } = req.body || {};

    if (!userOid || !groupId) {
      return res
        .status(400)
        .json({ error: "userOid and groupId are required" });
    }

    const token = await getAccessToken(req.tenantId);

    await axios.delete(
      `${GRAPH_URL}/groups/${groupId}/members/${userOid}/$ref`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("unassign_UserFromGroup error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAppRolesByAppRegistration = async (req, res) => {
  try {
    const { appId } = req.params || {};

    if (!appId) {
      return res.status(400).json({ error: "appId is required" });
    }

    const token = await getAccessToken(req.tenantId);

    // Look up the app registration by appId (client ID)
    const appResponse = await axios.get(
      `${GRAPH_URL}/applications?$filter=appId eq '${appId}'&$select=id,appId,displayName,appRoles`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const app = appResponse.data.value?.[0];

    if (!app) {
      return res.status(404).json({ error: "App registration not found" });
    }

    // Filter only enabled app roles
    const appRoles = app.appRoles
      .filter((role) => role.isEnabled)
      .map((role) => ({
        appRoleId: role.id,
        displayName: role.displayName,
        value: role.value, // e.g. "Admin", "Reader"
        description: role.description,
        allowedMemberTypes: role.allowedMemberTypes, // ["User", "Application", "Group"]
      }));

    return res.status(200).json({
      appId: app.appId,
      displayName: app.displayName,
      appRoles,
    });
  } catch (err) {
    console.error("getAppRolesByAppRegistration error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getUserGroupsByAppRole = async (req, res) => {
  try {
    const { userOid, clientId } = req.params || {};

    if (!userOid || !clientId) {
      return res
        .status(400)
        .json({ error: "userOid and clientId are required" });
    }

    const token = await getAccessToken(req.tenantId);

    // Step 1: Get the service principal by clientId
    const spResponse = await axios.get(
      `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${clientId}'&$select=id,appId,displayName`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      },
    );

    const servicePrincipal = spResponse.data.value?.[0];
    if (!servicePrincipal) {
      return res.status(404).json({
        error: "Service principal not found for the given clientId",
      });
    }

    // Step 2: Get user's app role assignments on that service principal
    const userRoleResponse = await axios.get(
      `${GRAPH_URL}/users/${userOid}/appRoleAssignments`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      },
    );

    const matchedAssignments = userRoleResponse.data.value.filter(
      (assignment) => assignment.resourceId === servicePrincipal.id,
    );

    if (!matchedAssignments.length) {
      return res
        .status(404)
        .json({ error: "User has no app role assignments for this app" });
    }

    // Step 3: For each app role the user has, find groups assigned to that same role
    const results = await Promise.all(
      matchedAssignments.map(async (assignment) => {
        const groupResponse = await axios.get(
          `${GRAPH_URL}/servicePrincipals/${servicePrincipal.id}/appRoleAssignedTo`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          },
        );

        // Filter in code instead of OData — avoids Edm.Guid vs Edm.String mismatch
        const groups = groupResponse.data.value
          .filter(
            (g) =>
              g.appRoleId === assignment.appRoleId &&
              g.principalType === "Group",
          )
          .map((g) => ({
            groupId: g.principalId,
            groupDisplayName: g.principalDisplayName,
          }));

        return {
          appRoleId: assignment.appRoleId,
          appRoleAssignmentId: assignment.id,
          groups,
        };
      }),
    );

    return res.status(200).json({
      userOid,
      clientId,
      servicePrincipalId: servicePrincipal.id,
      roles: results,
    });
  } catch (err) {
    console.error("getUserGroupsByAppRole error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAppRolesWithGroupsByClientId = async (req, res) => {
  try {

    // const { clientId } = req.params || {};

    // if (!clientId) {
    //   return res.status(400).json({ error: "clientId is required" });
    // }
    let { clientId } = req.params || {};
    clientId = clientId || "6ccf8b01-7af5-497b-9e23-45a92d68a226";

    const token = await getAccessToken(req.tenantId);

    // Step 1: Get app registration by clientId for app role definitions
    const appResponse = await axios.get(
      `${GRAPH_URL}/applications?$filter=appId eq '${clientId}'&$select=id,appId,displayName,appRoles`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const app = appResponse.data.value?.[0];
    if (!app) {
      return res.status(404).json({ error: "App registration not found" });
    }

    // Step 2: Get service principal by clientId for appRoleAssignedTo
    const spResponse = await axios.get(
      `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${clientId}'&$select=id,appId,displayName`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const servicePrincipal = spResponse.data.value?.[0];
    if (!servicePrincipal) {
      return res.status(404).json({
        error: "Service principal not found for the given clientId",
      });
    }

    // Step 3: Get all appRoleAssignedTo on the service principal
    const assignedToResponse = await axios.get(
      `${GRAPH_URL}/servicePrincipals/${servicePrincipal.id}/appRoleAssignedTo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const allAssignments = assignedToResponse.data.value;

    // Step 4: Map each enabled app role with its assigned groups
    const appRoles = app.appRoles
      .filter((role) => role.isEnabled)
      .map((role) => {
        const groups = allAssignments
          .filter((a) => a.appRoleId === role.id && a.principalType === "Group")
          .map((a) => ({
            groupId: a.principalId,
            groupDisplayName: a.principalDisplayName,
          }));

        return {
          appRoleId: role.id,
          displayName: role.displayName,
          value: role.value,
          description: role.description,
          allowedMemberTypes: role.allowedMemberTypes,
          groups,
        };
      });

    return res.status(200).json({
      clientId: app.appId,
      displayName: app.displayName,
      servicePrincipalId: servicePrincipal.id,
      appRoles,
    });
  } catch (err) {
    console.error("getAppRolesWithGroupsByClientId error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
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
};
