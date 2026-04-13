const client = require("../config/db");

const get_Notification = async (req, res) => {
    try {
        const { useruuid } = req.query;

        if (!useruuid) {
            return res.status(400).json({ error: "useruuid is required" });
        }

        const result = await client.query(
            "SELECT * FROM public.notification_get($1)",
            [useruuid]
        );

        return res.status(200).json(result.rows);
    } catch (err) {
        console.error("get_Notification error:", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const create_Notification = async (req, res) => {
    try {
        const { useruuid, ticketuuid, message, createdby } = req.body;

        if (!useruuid || !ticketuuid || !message || !createdby) {
            return res.status(400).json({
                error: "useruuid, ticketuuid, message, and createdby are required"
            });
        }

        const result = await client.query(
            "SELECT public.notification_create($1, $2, $3, $4) AS notificationuuid",
            [useruuid, ticketuuid, message, createdby]
        );

        const notificationuuid = result.rows[0]?.notificationuuid ?? null;

        return res.status(201).json({ notificationuuid });
    } catch (err) {
        console.error("create_Notification error:", err.message);

        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const delete_Notification = async (req, res) => {
    try {
        const { useruuid, deletedby, notificationuuid } = req.body;

        if (!useruuid || !deletedby) {
            return res.status(400).json({ error: "useruuid and deletedby are required" });
        }

        await client.query(
            "SELECT public.notification_delete($1, $2, $3)",
            [useruuid, deletedby, notificationuuid || null]
        );

        return res.status(200).json({
            message: "Notification delete successful"
        });
    } catch (err) {
        console.error("delete_Notification error:", err.message);

        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const markIsRead_Notification = async (req, res) => {
    try {
        const { useruuid, isread, modifiedby, notificationuuid } = req.body;

        if (!useruuid || isread === undefined || isread === null || !modifiedby) {
            return res.status(400).json({
                error: "useruuid, isread, and modifiedby are required"
            });
        }

        const normalizedIsRead = String(isread).toLowerCase();
        if (normalizedIsRead !== "true" && normalizedIsRead !== "false") {
            return res.status(400).json({ error: "isread must be true or false" });
        }

        await client.query(
            "SELECT public.notification_mark_isread($1, $2, $3, $4)",
            [useruuid, normalizedIsRead, modifiedby, notificationuuid || null]
        );

        return res.status(200).json({
            message: "Notification isread updated successfully"
        });
    } catch (err) {
        console.error("markIsRead_Notification error:", err.message);

        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    get_Notification,
    create_Notification,
    delete_Notification,
    markIsRead_Notification,
};