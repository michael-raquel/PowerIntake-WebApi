const client = require("../config/db");
 
const get_Attachment = async (req, res) => {
    try {
        const { ticketuuid, attachmentuuid } = req.query;
 
        const result = await client.query(
            "SELECT * FROM attachment_get($1, $2)",
            [ticketuuid || null, attachmentuuid || null]
        );
 
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("get_Attachment error:", err.message);
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const create_Attachment = async (req, res) => {
    try {
        const { ticketuuid, attachments, createdby } = req.body;
 
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
 
        const result = await client.query(
            "SELECT * FROM attachment_create($1, $2, $3)",
            [ticketuuid, toArray(attachments), createdby]
        );
 
        const attachmentuuids = result.rows[0].attachment_create;
 
        return res.status(201).json({
            attachmentuuids,
        });
    } catch (err) {
        console.error("create_Attachment error:", err.message);
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const update_Attachment = async (req, res) => {
    try {
        const { ticketuuid, attachments, modifiedby } = req.body;
 
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
 
        const result = await client.query(
            "SELECT * FROM attachment_update($1, $2, $3)",
            [ticketuuid, toArray(attachments), modifiedby]
        );
 
        const attachmentuuids = result.rows[0].attachment_update;
 
        return res.status(200).json({
            attachmentuuids,
        });
    } catch (err) {
        console.error("update_Attachment error:", err.message);
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
module.exports = {
    get_Attachment,
    create_Attachment,
    update_Attachment,
};