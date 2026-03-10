const client = require("../config/db");

const get_Tickets = async (req, res) => {
    try {
        const { ticketuuid, userid } = req.query;

        const result = await client.query(
            "SELECT * FROM ticket_get($1, $2)",
            [ticketuuid || null, userid || null]
        );

        res.status(200).json(result.rows);
    }   
    catch (err) {
        res.status(500).send("Internal Server Error");
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

        const ticketuuid = result.rows[0].ticket_create;

        return res.status(201).json({
            ticketuuid,
        });

    } catch (err) {
        console.error("create_Ticket error:", err.message);

        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    create_Ticket,
    get_Tickets
};