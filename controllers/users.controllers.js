const axios = require('axios');
const { getAccessToken } = require('../config/authService');

const GRAPH_URL = 'https://graph.microsoft.com/v1.0';
const USER_FIELDS = [
 
  'id',
  'displayName',
  'givenName',
  'surname',
  'mail',
  'userPrincipalName',
  'jobTitle',
  'department',
  'officeLocation',
  'mobilePhone',
  'businessPhones',
  'preferredLanguage',
  'accountEnabled',

  'ageGroup',
  'city',
  'companyName',
  'country',
  'createdDateTime',
  'mailNickname',
  'proxyAddresses',
  'state',
  'streetAddress',
  'usageLocation',
  'userType',
].join(',');

const get_AllUsers = async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(`${GRAPH_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { $select: USER_FIELDS, $top: 999 },
      timeout: 10000,
    });

    return res.status(200).json({
      count: response.data.value.length,
      users: response.data.value,
    });

  } catch (err) {
    console.error("get_AllUsers error:", err.message);

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

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

const get_UserById = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/users/${id}`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: USER_FIELDS },
    });

    res.status(200).json(response.data);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_UserManager = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(
      `${GRAPH_URL}/users/${id}/manager`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
    );

    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    res.status(status).send(status === 404 ? 'No manager found for this user' : 'Internal Server Error');
  }
};

const get_UserDirectReports = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(
      `${GRAPH_URL}/users/${id}/directReports`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
    );

    res.status(200).json({
      count: response.data.value.length,
      directReports: response.data.value,
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_UserFullProfile = async (req, res) => {
  try {
    const { id } = req.query;
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [userRes, managerRes, reportsRes] = await Promise.allSettled([
      axios.get(`${GRAPH_URL}/users/${id}`, { headers, params: { $select: USER_FIELDS } }),
      axios.get(`${GRAPH_URL}/users/${id}/manager`, { headers }),
      axios.get(`${GRAPH_URL}/users/${id}/directReports`, { headers }),
    ]);

    res.status(200).json({
      user:          userRes.status    === 'fulfilled' ? userRes.value.data              : null,
      manager:       managerRes.status === 'fulfilled' ? managerRes.value.data           : null,
      directReports: reportsRes.status === 'fulfilled' ? reportsRes.value.data.value    : [],
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};


const get_AllUsersWithDetails = async (req, res) => {
  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const usersRes = await axios.get(`${GRAPH_URL}/users`, {
      headers,
      params: { $select: USER_FIELDS, $top: 999 },
      timeout: 10000,
    });

    const users = usersRes.data.value;

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [managerRes, reportsRes, groupsRes, rolesRes] = await Promise.allSettled([
          axios.get(`${GRAPH_URL}/users/${user.id}/manager`, { headers }),
          axios.get(`${GRAPH_URL}/users/${user.id}/directReports`, { headers }),
          axios.get(`${GRAPH_URL}/users/${user.id}/memberOf`, {
            headers,
            params: { $select: 'id,displayName,groupTypes,securityEnabled' }
          }),
          axios.get(`${GRAPH_URL}/users/${user.id}/memberOf/microsoft.graph.directoryRole`, {
            headers,
            params: { $select: 'id,displayName,description,roleTemplateId' }
          }),
        ]);

        return {
          ...user,
          manager:       managerRes.status  === 'fulfilled' ? managerRes.value.data          : null,
          directReports: reportsRes.status  === 'fulfilled' ? reportsRes.value.data.value    : [],
          groups:        groupsRes.status   === 'fulfilled' ? groupsRes.value.data.value     : [],
          roles:         rolesRes.status    === 'fulfilled' ? rolesRes.value.data.value      : [],
        };
      })
    );

    return res.status(200).json({
      count: enrichedUsers.length,
      users: enrichedUsers,
    });

  } catch (err) {
    console.error("get_AllUsersWithDetails error:", err.message);

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

const get_UserGroups = async (req, res) => {
  try {
    const { id } = req.query;
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [directRes, transitiveRes] = await Promise.allSettled([
      axios.get(`${GRAPH_URL}/users/${id}/memberOf`, {
        headers,
        params: { $select: 'id,displayName,groupTypes,securityEnabled,mail' },
      }),
      axios.get(`${GRAPH_URL}/users/${id}/transitiveMemberOf/microsoft.graph.group`, {
        headers,
        params: { $select: 'id,displayName,groupTypes,securityEnabled,mail' },
      }),
    ]);

    res.status(200).json({
      directGroups:     directRes.status     === 'fulfilled' ? directRes.value.data.value     : [],
      transitiveGroups: transitiveRes.status === 'fulfilled' ? transitiveRes.value.data.value : [],
    });

  } catch (err) {

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

const get_UserAppRoleAssignments = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/users/${id}/appRoleAssignments`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: 'id,appRoleId,resourceId,resourceDisplayName,principalId' },
    });

    res.status(200).json({
      count: response.data.value.length,
      appRoleAssignments: response.data.value,
    });

  } catch (err) {
    console.error("get_UserAppRoleAssignments error:", err.message);

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
  get_AllUsers,
  get_UserById,
  get_UserManager,
  get_UserDirectReports,
  get_UserFullProfile,
  get_AllUsersWithDetails,
  get_UserGroups,
  get_UserAppRoleAssignments
};