const axios = require('axios');
const { getAccessToken } = require('../config/authService');

const GRAPH_URL = 'https://graph.microsoft.com/v1.0';
const ALLOWED_PRINCIPAL_TYPES = ['users', 'groups', 'servicePrincipals'];

function resolvePrincipalType(rawType) {
  const principalType = (rawType || 'users').trim();
  if (!ALLOWED_PRINCIPAL_TYPES.includes(principalType)) {
    throw new Error('Invalid principalType. Must be one of users, groups, servicePrincipals.');
  }
  return principalType;
}

// GET /roles/app-role-assignments?principalId=...&principalType=...
const get_AppRoleAssignments = async (req, res) => {
  try {
    const { principalId, principalType: rawType } = req.query;

    if (!principalId) {
      return res.status(400).json({ error: 'principalId is required' });
    }

    const principalType = resolvePrincipalType(rawType);
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    let assignments = [];
    let url = `${GRAPH_URL}/${principalType}/${principalId}/appRoleAssignments`;

    while (url) {
      const response = await axios.get(url, {
        headers,
        params: url.includes('/appRoleAssignments?')
          ? {}
          : { $select: 'id,appRoleId,principalId,resourceId,createdDateTime', $top: 999 },
        timeout: 10000,
      });

      assignments = [...assignments, ...response.data.value];
      url = response.data['@odata.nextLink'] || null;
    }

    return res.status(200).json({
      count: assignments.length,
      appRoleAssignments: assignments,
    });
  } catch (err) {
    console.error('get_AppRoleAssignments error:', err.message);

    if (err.message && err.message.startsWith('Invalid principalType')) {
      return res.status(400).json({ error: err.message });
    }

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || 'Graph API Error',
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: 'No response from Microsoft Graph (Timeout or Network Issue)',
      });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// POST /roles/app-role-assignments
// body: { principalId, resourceId, appRoleId, principalType? }
const create_AppRoleAssignment = async (req, res) => {
  try {
    const { principalId, resourceId, appRoleId, principalType: rawType } = req.body;

    if (!principalId || !resourceId || !appRoleId) {
      return res.status(400).json({
        error: 'principalId, resourceId, and appRoleId are required',
      });
    }

    const principalType = resolvePrincipalType(rawType);
    const token = await getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const url = `${GRAPH_URL}/${principalType}/${principalId}/appRoleAssignments`;

    const response = await axios.post(
      url,
      {
        principalId,
        resourceId,
        appRoleId,
      },
      { headers, timeout: 10000 }
    );

    return res.status(201).json(response.data);
  } catch (err) {
    console.error('create_AppRoleAssignment error:', err.message);

    if (err.message && err.message.startsWith('Invalid principalType')) {
      return res.status(400).json({ error: err.message });
    }

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || 'Graph API Error',
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: 'No response from Microsoft Graph (Timeout or Network Issue)',
      });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// DELETE /roles/app-role-assignments/:principalId/:assignmentId?principalType=...
const delete_AppRoleAssignment = async (req, res) => {
  try {
    const { principalId, assignmentId } = req.params;
    const { principalType: rawType } = req.query;

    if (!principalId || !assignmentId) {
      return res.status(400).json({
        error: 'principalId and assignmentId are required',
      });
    }

    const principalType = resolvePrincipalType(rawType);
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const url = `${GRAPH_URL}/${principalType}/${principalId}/appRoleAssignments/${assignmentId}`;

    await axios.delete(url, { headers, timeout: 10000 });

    return res.status(200).json({
      success: true,
      message: 'App role assignment deleted.',
    });
  } catch (err) {
    console.error('delete_AppRoleAssignment error:', err.message);

    if (err.message && err.message.startsWith('Invalid principalType')) {
      return res.status(400).json({ error: err.message });
    }

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || 'Graph API Error',
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: 'No response from Microsoft Graph (Timeout or Network Issue)',
      });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
const POWERINTAKE_CLIENT_ID = '6ccf8b01-7af5-497b-9e23-45a92d68a226';

const get_AppRoleAssignment = async (req, res) => {
  try {
    const { principalId } = req.query;

    if (!principalId) {
      return res.status(400).json({ error: 'principalId is required' });
    }

    const token = await getAccessToken();

    // Step 1: Resolve Service Principal ID from Client ID
    const spResponse = await axios.get(
      `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${POWERINTAKE_CLIENT_ID}'&$select=id,displayName`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );

    const servicePrincipal = spResponse.data.value?.[0];
    if (!servicePrincipal) {
      return res.status(404).json({ error: 'Service principal not found' });
    }

    const servicePrincipalId = servicePrincipal.id;

    // Step 2: Get ALL assigned users for this app — no $filter
    const url = `${GRAPH_URL}/servicePrincipals/${servicePrincipalId}/appRoleAssignedTo`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        $select: 'id,appRoleId,principalId,principalDisplayName',
      },
      timeout: 10000,
    });

    // Step 3: Filter client-side by principalId
    const assignment = response.data.value.find(
      (a) => a.principalId === principalId  // ✅ plain string comparison
    );

    if (!assignment) {
      return res.status(404).json({ error: 'No app role assigned to this user' });
    }

    return res.status(200).json({
      principalId,
      principalDisplayName: assignment.principalDisplayName,
      appRoleId: assignment.appRoleId,
    });

  } catch (err) {
    console.error('get_AppRoleAssignment error:', err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || 'Graph API Error',
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: 'No response from Microsoft Graph (Timeout or Network Issue)',
      });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
module.exports = {
  get_AppRoleAssignments,
  create_AppRoleAssignment,
  delete_AppRoleAssignment,
  get_AppRoleAssignment,
};