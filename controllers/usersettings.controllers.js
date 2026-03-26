const client = require("../config/db");
 
const get_UserSettings = async (req, res) => {
    try {
        const { useruuid, entrauserid } = req.query;
 
        const result = await client.query(
            "SELECT * FROM usersettings_get($1, $2)",
            [useruuid || null, entrauserid || null]
        );
 
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const create_UserSettings = async (req, res) => {
    try {
        const {
            entrauserid,
            outlook,
            teams,
            powersuiteai,
            spartaassist,
            darkmode,
            createdby,
        } = req.body;
 
        const result = await client.query(
            "SELECT * FROM usersettings_create($1, $2, $3, $4, $5, $6, $7)",
            [
                entrauserid,
                outlook,
                teams,
                powersuiteai,
                spartaassist,
                darkmode,
                createdby,
            ]
        );
 
        const usersettingsuuid = result.rows[0].usersettings_create;
 
        return res.status(201).json({
            usersettingsuuid,
        });
    } catch (err) {
        console.error("create_UserSettings error:", err.message);
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const update_UserSettings = async (req, res) => {
    try {
        const {
            usersettingsuuid,
            outlook,
            teams,
            powersuiteai,
            spartaassist,
            darkmode,
            modifiedby,
        } = req.body;
 
        const result = await client.query(
            "SELECT * FROM usersettings_update($1, $2, $3, $4, $5, $6, $7)",
            [
                usersettingsuuid,
                outlook,
                teams,
                powersuiteai,
                spartaassist,
                darkmode,
                modifiedby,
            ]
        );
 
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("update_UserSettings error:", err.message);
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const update_UserSettings_RecordCounts = async (req, res) => {
    try {
        const {
            entrauserid,
            ticketrecordcount,
            managerecordcount,
            modifiedby,
        } = req.body;

        if (!entrauserid) {
            return res.status(400).json({ error: "entrauserid is required" });
        }

        await client.query(
            "SELECT public.user_settings_record_counts_update($1, $2, $3, $4)",
            [
                entrauserid,
                ticketrecordcount,
                managerecordcount,
                modifiedby,
            ]
        );

        return res.status(200).json({ message: "Record counts updated successfully" });
    } catch (err) {
        console.error("update_UserSettings_RecordCounts error:", err.message);

        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    create_UserSettings,
    get_UserSettings,
    update_UserSettings,
    update_UserSettings_RecordCounts,
};