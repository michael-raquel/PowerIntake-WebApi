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
            modifiedby,
        } = req.body;
 
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
 
        const result = await client.query(
            "SELECT * FROM ticket_update($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
                ticketuuid,
                title,
                description,
                usertimezone,
                officelocation,
                toArray(date),
                toArray(starttime),
                toArray(endtime),
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
 
module.exports = {
    create_Ticket,
    get_Ticket,
    update_Ticket,
    get_Ticket_Status,
    get_ManagerTeamTickets,
    get_ManagerTickets
};