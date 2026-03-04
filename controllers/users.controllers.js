const axios = require('axios');
const { getAccessToken } = require('../config/authService');

const GRAPH_URL = 'https://graph.microsoft.com/v1.0';
const USER_FIELDS = [
  'id', 'displayName', 'mail', 'userPrincipalName',
  'jobTitle', 'department', 'officeLocation',
  'mobilePhone', 'businessPhones'
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

module.exports = {
  get_AllUsers,
  get_UserById,
  get_UserManager,
  get_UserDirectReports,
  get_UserFullProfile,
};