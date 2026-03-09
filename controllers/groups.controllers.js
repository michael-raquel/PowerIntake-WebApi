const axios = require('axios');
const { getAccessToken } = require('../config/authService');

const GRAPH_URL = 'https://graph.microsoft.com/v1.0';

const GROUP_FIELDS = [
  'id',
  'displayName',
  'description',
  'mail',
  'mailEnabled',
  'securityEnabled',
  'groupTypes',
  'membershipRule',
  'membershipRuleProcessingState',
  'createdDateTime',
  'visibility',
  'classification',
].join(',');

const get_AllGroups = async (req, res) => {
  try {
    const token = await getAccessToken();
    let groups = [];
    let url = `${GRAPH_URL}/groups`;

    while (url) {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params: url === `${GRAPH_URL}/groups` ? { $select: GROUP_FIELDS, $top: 999 } : {},
        timeout: 10000,
      });

      groups = [...groups, ...response.data.value];
      url = response.data['@odata.nextLink'] || null;
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
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: GROUP_FIELDS },
    });

    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    res.status(status).send(status === 404 ? 'Group not found' : 'Internal Server Error');
  }
};

const get_GroupMembers = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/groups/${id}/members`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: 'id,displayName,mail,userPrincipalName,jobTitle', $top: 999 },
    });

    res.status(200).json({
      count: response.data.value.length,
      members: response.data.value,
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_GroupOwners = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/groups/${id}/owners`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: 'id,displayName,mail,userPrincipalName' },
    });

    res.status(200).json({
      count: response.data.value.length,
      owners: response.data.value,
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_GroupFullProfile = async (req, res) => {
  try {
    const { id } = req.query;
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [groupRes, membersRes, ownersRes] = await Promise.allSettled([
      axios.get(`${GRAPH_URL}/groups/${id}`, { headers, params: { $select: GROUP_FIELDS } }),
      axios.get(`${GRAPH_URL}/groups/${id}/members`, { headers, params: { $select: 'id,displayName,mail,userPrincipalName,jobTitle', $top: 999 } }),
      axios.get(`${GRAPH_URL}/groups/${id}/owners`, { headers, params: { $select: 'id,displayName,mail,userPrincipalName' } }),
    ]);

    res.status(200).json({
      group:   groupRes.status   === 'fulfilled' ? groupRes.value.data          : null,
      members: membersRes.status === 'fulfilled' ? membersRes.value.data.value  : [],
      owners:  ownersRes.status  === 'fulfilled' ? ownersRes.value.data.value   : [],
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_AllGroupsWithMembers = async (req, res) => {
  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    let groups = [];
    let url = `${GRAPH_URL}/groups`;

    while (url) {
      const response = await axios.get(url, {
        headers,
        params: url === `${GRAPH_URL}/groups` ? { $select: GROUP_FIELDS, $top: 999 } : {},
        timeout: 10000,
      });
      groups = [...groups, ...response.data.value];
      url = response.data['@odata.nextLink'] || null;
    }

    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const [membersRes, ownersRes] = await Promise.allSettled([
          axios.get(`${GRAPH_URL}/groups/${group.id}/members`, {
            headers,
            params: { $select: 'id,displayName,mail,userPrincipalName,jobTitle,department', $top: 999 },
          }),
          axios.get(`${GRAPH_URL}/groups/${group.id}/owners`, {
            headers,
            params: { $select: 'id,displayName,mail,userPrincipalName' },
          }),
        ]);

        return {
          ...group,
          members: membersRes.status === 'fulfilled' ? membersRes.value.data.value : [],
          owners:  ownersRes.status  === 'fulfilled' ? ownersRes.value.data.value  : [],
          memberCount: membersRes.status === 'fulfilled' ? membersRes.value.data.value.length : 0,
        };
      })
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

module.exports = {
  get_AllGroups,
  get_GroupById,
  get_GroupMembers,
  get_GroupOwners,
  get_GroupFullProfile,
  get_AllGroupsWithMembers,
};