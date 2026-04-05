const client = require("../config/db");
const axios = require("axios");
const { getDynamicsToken } = require("../utils/dynamicsToken");

const cancel_DynamicsTicket = async (req, res) => {
    try {
        const { ticketuuid, createdby } = req.body;

        if (!ticketuuid) {
            return res.status(400).json({ error: "ticketuuid is required" });
        }

        const dynamicsResult = await client.query(
            "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
            [ticketuuid]
        );

        const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

        if (!dynamicsIncidentId) {
            return res.status(404).json({ error: "No Dynamics incident linked to this ticket" });
        }

        const token = await getDynamicsToken();

        await axios.patch(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents(${dynamicsIncidentId})`,
            { statecode: 2,  statuscode:   6,  ss_ticketstage: 7 },
            {
                headers: {
                    Authorization:      `Bearer ${token}`,
                    Accept:             "application/json",
                    "Content-Type":     "application/json",
                    "OData-Version":    "4.0",
                    "OData-MaxVersion": "4.0",
                }
            }
        );

        // await client.query(
        //     `SELECT note_create_action($1, $2, $3)`,
        //     [ticketuuid, createdby, 'Ticket cancelled']
        // );

        console.log(`[DYNAMICS] Ticket cancelled: ${dynamicsIncidentId}`);

        const io = req.app.get("io");
        if (io) {
            try {
                const ticketInfoResult = await client.query(
                    `SELECT * FROM ticket_get_webhook_info($1::text[])`,
                    [[dynamicsIncidentId]]
                );
                const ticketInfo = ticketInfoResult.rows[0] ?? null;

                if (ticketInfo) {
                    const updatedResult = await client.query(
                        `SELECT * FROM public.ticket_get($1, NULL, NULL)`,
                        [String(ticketuuid)]
                    );
                    const updatedTicket = updatedResult.rows[0] ?? null;

                    const payload = {
                        ticketuuid:         String(ticketuuid),
                        dynamicsincidentid: dynamicsIncidentId,
                        ticket:             updatedTicket,
                    };

                    if (ticketInfo.entrauserid) {
                        io.to(ticketInfo.entrauserid).emit("ticket:cancelled", payload);
                        console.log(`[WS] Emitted ticket:cancelled to: ${ticketInfo.entrauserid}`);
                    }
                }
            } catch (wsErr) {
                console.error("[CANCEL] Socket emit failed:", wsErr.message);
            }
        }

        return res.status(200).json({ message: "Ticket cancelled successfully", dynamicsIncidentId });

    } catch (err) {
        console.error("[DYNAMICS] Cancel error:", err.response?.data ?? err.message);
        return res.status(500).json({
            error:   "Failed to cancel ticket in Dynamics",
            details: err.response?.data ?? err.message,
        });
    }
};

const resolve_DynamicsTicket = async (req, res) => {
    try {
        const { ticketuuid, createdby, resolution } = req.body;

        if (!ticketuuid) {
            return res.status(400).json({ error: "ticketuuid is required" });
        }

        const dynamicsResult = await client.query(
            "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
            [ticketuuid]
        );

        const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

        if (!dynamicsIncidentId) {
            return res.status(404).json({ error: "No Dynamics incident linked to this ticket" });
        }

        const token = await getDynamicsToken();

        await axios.post(
        `${process.env.DYNAMICS_URL}/api/data/v9.2/CloseIncident`,
        {
            "IncidentResolution": {
                "@odata.type":           "Microsoft.Dynamics.CRM.incidentresolution",
                "subject":               resolution ?? "Ticket Resolved",
                "incidentid@odata.bind": `/incidents(${dynamicsIncidentId})`,
            },
            "Status": 5  // Problem Solved
        },
        {
            headers: {
                Authorization:      `Bearer ${token}`,
                Accept:             "application/json",
                "Content-Type":     "application/json",
                "OData-Version":    "4.0",
                "OData-MaxVersion": "4.0",
            }
        }
    );

        // await client.query(
        //     `SELECT note_create_action($1, $2, $3)`,
        //     [ticketuuid, createdby, 'Ticket resolved']
        // );

        console.log(`[DYNAMICS] Ticket resolved: ${dynamicsIncidentId}`);

        const io = req.app.get("io");
        if (io) {
            try {
                const ticketInfoResult = await client.query(
                    `SELECT * FROM ticket_get_webhook_info($1::text[])`,
                    [[dynamicsIncidentId]]
                );
                const ticketInfo = ticketInfoResult.rows[0] ?? null;

                if (ticketInfo) {
                    const updatedResult = await client.query(
                        `SELECT * FROM public.ticket_get($1, NULL, NULL)`,
                        [String(ticketuuid)]
                    );
                    const updatedTicket = updatedResult.rows[0] ?? null;

                    const payload = {
                        ticketuuid:         String(ticketuuid),
                        dynamicsincidentid: dynamicsIncidentId,
                        ticket:             updatedTicket,
                    };

                    if (ticketInfo.entrauserid) {
                        io.to(ticketInfo.entrauserid).emit("ticket:resolved", payload);
                        console.log(`[WS] Emitted ticket:resolved to: ${ticketInfo.entrauserid}`);
                    }
                }
            } catch (wsErr) {
                console.error("[RESOLVE] Socket emit failed:", wsErr.message);
            }
        }

        return res.status(200).json({ message: "Ticket resolved successfully", dynamicsIncidentId });

    } catch (err) {
        console.error("[DYNAMICS] Cancel/Resolve error:");
        console.error("[DYNAMICS] Status:", err.response?.status);
        console.error("[DYNAMICS] Response:", JSON.stringify(err.response?.data, null, 2));
        return res.status(500).json({
            error:   "Failed",
            details: err.response?.data ?? err.message,
        });
    }
};


module.exports = {
    cancel_DynamicsTicket,
    resolve_DynamicsTicket,
    // reactivate_DynamicsTicket,
}