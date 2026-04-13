const client = require("../config/db");

const get_PowerSuiteAILogs = async (req, res) => {
	try {
		const { powersuiteailogsuuid, entrauserid, ticketnumber } = req.query;

		const result = await client.query(
			"SELECT * FROM powersuiteailogs_get($1, $2, $3)",
			[powersuiteailogsuuid || null, entrauserid || null, ticketnumber || null]
		);

		res.status(200).json(result.rows);
	} catch (err) {
		res.status(500).json({ error: "Internal Server Error" });
	}
};

const create_PowerSuiteAILogs = async (req, res) => {
	try {
		const { entrauserid, title, description, suggestion, feedback, createdby } = req.body;

		const result = await client.query(
			"SELECT powersuiteailogs_create($1, $2, $3, $4, $5, $6) AS powersuiteailogsuuid",
			[
				entrauserid || null,
				title || null,
				description || null,
				suggestion || null,
				feedback ?? null,
				createdby || null,
			]
		);

		return res.status(201).json({
			powersuiteailogsuuid: result.rows[0]?.powersuiteailogsuuid ?? null,
		});
	} catch (err) {
		console.error("create_PowerSuiteAILogs error:", err.message);

		if (err.message?.includes("VALIDATION_ERROR")) {
			return res.status(400).json({ error: err.message });
		}

		return res.status(500).json({ error: "Internal Server Error" });
	}
};

const delete_PowerSuiteAILogs = async (req, res) => {
	try {
		const { powersuiteailogsuuid } = req.params;

		const result = await client.query(
			"SELECT powersuiteailogs_delete($1) AS powersuiteailogsuuid",
			[powersuiteailogsuuid || null]
		);

		return res.status(200).json({
			powersuiteailogsuuid: result.rows[0]?.powersuiteailogsuuid ?? null,
		});
	} catch (err) {
		console.error("delete_PowerSuiteAILogs error:", err.message);

		if (err.message?.includes("VALIDATION_ERROR")) {
			return res.status(400).json({ error: err.message });
		}

		return res.status(500).json({ error: "Internal Server Error" });
	}
};

const update_PowerSuiteAILogs_TicketId = async (req, res) => {
	try {
		const { powersuiteailogsuuid, ticketuuid } = req.body;

		const result = await client.query(
			"SELECT powersuiteailogs_ticketid_update($1, $2) AS powersuiteailogsuuid",
			[powersuiteailogsuuid || null, ticketuuid || null]
		);

		return res.status(200).json({
			powersuiteailogsuuid: result.rows[0]?.powersuiteailogsuuid ?? null,
		});
	} catch (err) {
		console.error("update_PowerSuiteAILogs_TicketId error:", err.message);

		if (err.message?.includes("VALIDATION_ERROR")) {
			return res.status(400).json({ error: err.message });
		}

		return res.status(500).json({ error: "Internal Server Error" });
	}
};

module.exports = {
	get_PowerSuiteAILogs,
	create_PowerSuiteAILogs,
	delete_PowerSuiteAILogs,
	update_PowerSuiteAILogs_TicketId,
};
