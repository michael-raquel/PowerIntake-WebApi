const client = require("../config/db");
const axios = require("axios");
const { getAccessToken } = require('../config/authService');
const GRAPH_URL = "https://graph.microsoft.com/v1.0"; 

const get_Ticket = async (req, res) => {
    try {
        const { ticketuuid, entrauserid, entratenantid } = req.query;

        const result = await client.query(
            "SELECT * FROM ticket_get($1, $2, $3)",
            [ticketuuid || null, entrauserid || null, entratenantid || null]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const get_Ticket_Status = async (req, res) => {
    try {

        const { ticketuuid } = req.query;

        const result = await client.query(
            "SELECT * FROM ticketstatus_get($1)",
            [ticketuuid || null]
        );
     
        res.status(200).json(result.rows);

    } catch (err) {
      
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const get_ManagerTeamTickets = async (req, res) => {
  try {
    const { managerid } = req.query;

    const directReportsResponse = await axios.get(
      `${GRAPH_URL}/users/${managerid}/directReports`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
    );

    const directReports = directReportsResponse.data.value;

    const ticketResults = await Promise.all(
      directReports.map(async (user) => {
        const result = await client.query(
          "SELECT * FROM ticket_get($1, $2)",
          [null, user.id]
        );
        return {
          user: user.displayName,
          entrauserid: user.id,
          tickets: result.rows,
        };
      })
    );

    res.status(200).json({
      manager: managerid,
      team: ticketResults,
    });

  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

const get_ManagerTickets = async (req, res) => {
    try {
        const { managerentrauserid, status } = req.query;

        if (!managerentrauserid) {
            return res.status(400).json({ error: "managerentrauserid is required" });
        }

        const result = await client.query(
            "SELECT * FROM ticket_manager_get($1, $2)",
            [managerentrauserid, status || null]
        );

        return res.status(200).json(result.rows);

    } catch (err) {
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const create_Ticket = async (req, res) => {
    try {
        const {
            entrauserid,
            entratenantid,
            title,
            description,
            date,
            starttime,
            endtime,
            usertimezone,
            officelocation,
            attachments,
            createdby,
        } = req.body;
 
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
 
        const result = await client.query(
            "SELECT * FROM ticket_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            [
                entrauserid,
                entratenantid,
                title,
                description,
                toArray(date),
                toArray(starttime),
                toArray(endtime),
                usertimezone,
                officelocation,
                toArray(attachments),
                createdby,
            ]
        );
 
        const { ticketuuid, ticketnumber } = result.rows[0];
 
        return res.status(201).json({
            ticketuuid,
            ticketnumber,
        });
 
    } catch (err) {
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const update_Ticket = async (req, res) => {
    try {
        const {
            ticketuuid,
            title,
            description,
            usertimezone,
            officelocation,
            date,
            starttime,
            endtime,
            attachments,
            modifiedby,
        } = req.body;
 
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
 
        const result = await client.query(
            "SELECT * FROM ticket_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            [
                ticketuuid,
                title,
                description,
                usertimezone,
                officelocation,
                toArray(date),
                toArray(starttime),
                toArray(endtime),
                toArray(attachments),
                modifiedby
            ]
        );
 
        res.status(200).json(result.rows[0]);
    } catch (err) {
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};

 const getDynamicsToken = async () => {
    try {
        require("dotenv").config();

        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", process.env.AZURE_CLIENT_ID);
        params.append("client_secret", process.env.AZURE_CLIENT_SECRET);
        params.append("scope", `${process.env.DYNAMICS_URL}/.default`);

        const response = await axios.post(
            `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
            params.toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        // console.log("TOKEN RECEIVED:", response.data.access_token.slice(0, 20) + "..."); 
        return response.data.access_token;

    } catch (err) {
        // console.error("TOKEN ERROR:", err.response?.data || err.message);
        throw new Error("Failed to get Dynamics token");
    }
};

const get_DynamicsTickets = async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate are required" });
        }

        const token = await getDynamicsToken();

        const start = `${startDate}T00:00:00Z`;
        const end = `${endDate}T23:59:59Z`;

        let filter = `createdon ge ${start} and createdon le ${end}`;
        if (status !== undefined) {
            filter += ` and statecode eq ${parseInt(status, 10)}`;
        }

        const filterEncoded = encodeURIComponent(filter);

        const response = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$select=incidentid,ticketnumber,title,description,prioritycode,ownerid,createdon,statecode&$filter=${filterEncoded}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "OData-Version": "4.0",
                    "OData-MaxVersion": "4.0"
                }
            }
        );

        const ticketcount = response.data.value.length;
        
        return res.status(200).json({ tickets: response.data.value, count: ticketcount });

    } catch (err) {
        // console.error("DYNAMICS ERROR:", err.response?.data || err.message);
        return res.status(500).json({
            error: "Failed to fetch tickets from Dynamics",
            details: err.response?.data || err.message
        });
    }
};


module.exports = {
    create_Ticket,
    get_Ticket,
    update_Ticket,
    get_Ticket_Status,
    get_ManagerTeamTickets,
    get_ManagerTickets,
    getDynamicsToken,
    get_DynamicsTickets
};