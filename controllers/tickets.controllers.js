const client = require("../config/db");
const axios = require("axios");

const DYNAMICS_URL = process.env.DYNAMICS_URL;

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

        const accessToken = req.headers.authorization?.split(' ')[1];
        if (!accessToken) {
            return res.status(401).json({ error: 'No access token provided' });
        }

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

        const ticketuuid = result.rows[0].ticket_create;

        const dynamicsResponse = await axios.post(
            `${DYNAMICS_URL}/api/data/v9.2/incidents`,
            {
                title: title,
                description: description,
                ticketnumber: ticketuuid,
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0',
                    'Accept': 'application/json',
                },
            }
        );

        const dynamicsIncidentId = dynamicsResponse.headers['odata-entityid']
            ?.match(/\(([^)]+)\)/)?.[1] || null;

        return res.status(201).json({
            ticketuuid,
            dynamicsincidentid: dynamicsIncidentId,
        });

    } catch (err) {
        console.error("create_Ticket error:", err.message);

        if (err.response?.data) {
            return res.status(err.response.status).json({
                error: err.response.data?.error?.message || "Dynamics API Error",
            });
        }

        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    create_Ticket,
};