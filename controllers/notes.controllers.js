const client = require("../config/db");
const axios = require("axios");
const { getDynamicsToken } = require("../utils/dynamicsToken");
const { dynamicsHeaders } = require("../utils/dynamicsHelpers");


const stripHtml = (html) => {
    if (!html) return null;
    return html
        .replace(/<[^>]*>/g, '')   
        .replace(/&nbsp;/g, ' ')   
        .replace(/&amp;/g, '&')    
        .replace(/&lt;/g, '<')     
        .replace(/&gt;/g, '>')     
        .replace(/&quot;/g, '"')   
        .trim();
};

const get_Note = async (req, res) => {
  try {
    const { noteuuid, ticketuuid } = req.query;

    const result = await client.query("SELECT * FROM note_get($1, $2)", [
      noteuuid || null,
      ticketuuid || null,
    ]);

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

const syncNoteToDynamics = async ({ token, dynamicsIncidentId, note }) => {
    const payload = {
        subject: "Client Note",
        notetext: note,
        "objectid_incident@odata.bind": `/incidents(${dynamicsIncidentId})`,
    };

    const response = await axios.post(
        `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations`,
        payload,
        { headers: dynamicsHeaders(token) }
    );

    const entityUrl =
        response.headers["odata-entityid"] ||
        response.headers["OData-EntityId"];

    let annotationid = null;

    if (entityUrl) {
        const match = entityUrl.match(/\(([^)]+)\)/);
        annotationid = match ? match[1] : null;
    }

    console.log("[DYNAMICS] annotationid:", annotationid);

    return annotationid;
};

const create_Note = async (req, res) => {
    try {
        const { ticketuuid, note, createdby } = req.body;

        const dbResult = await client.query(
            "SELECT note_create($1, $2, $3) AS noteuuid",
            [ticketuuid, stripHtml(note), createdby]
        );

        const noteuuid = dbResult.rows[0].noteuuid;

        res.status(201).json({ noteuuid });

        (async () => {
            try {
                const [token, dynamicsResult] = await Promise.all([
                    getDynamicsToken(),
                    client.query(
                        "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
                        [ticketuuid]
                    )
                ]);

                const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

                if (!dynamicsIncidentId) {
                    console.warn(`[DYNAMICS] No dynamicsincidentid for ticketuuid: ${ticketuuid}`);
                    return;
                }

                const annotationid = await syncNoteToDynamics({
                    token,
                    dynamicsIncidentId,
                    note,
                    // createdbyEmail: createdby
                });

                console.log("Returned annotationid:", annotationid);
                console.log("NoteUUID:", noteuuid);

                if (annotationid && noteuuid) {
                   await client.query(`SELECT note_update_annotation($1, $2)`, [noteuuid, annotationid]);

                    console.log(`[DYNAMICS] annotationid saved: ${annotationid}`);
                }

            } catch (err) {
                console.error("[DYNAMICS BACKGROUND ERROR]:", err.response?.data || err.message);
            }
        })();

    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};

const update_Note = async (req, res) => {
    try {
        const { noteuuid } = req.params;
        const { note, modifiedby } = req.body;

        const result = await client.query(
            "SELECT * FROM note_update($1, $2, $3)",
            [noteuuid, note, modifiedby]
        );

        res.status(200).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).send("Internal Server Error");
    }
};


module.exports = {
  get_Note,
  create_Note,
  update_Note
};
