const client = require("../config/db");
const axios  = require("axios"); // ← missing import
const { BlobServiceClient } = require("@azure/storage-blob");
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME    = process.env.AZURE_STORAGE_CONTAINER || "images";
const { getDynamicsToken } = require("../utils/dynamicsToken");
const { dynamicsHeaders } = require("../utils/dynamicsHelpers");

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
        if (err.message) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const downloadBlobAsBase64 = async (blobUrl) => {
    const urlWithoutSas = blobUrl.split('?')[0];
    const blobName      = urlWithoutSas.split('/').pop();

    const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    const containerClient   = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blockBlobClient   = containerClient.getBlockBlobClient(decodeURIComponent(blobName));

    const downloadResponse = await blockBlobClient.download(0);

    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const buffer   = Buffer.concat(chunks);
    const base64   = buffer.toString('base64');
    const mimetype = downloadResponse.contentType || 'application/octet-stream';

    return { base64, mimetype, filename: decodeURIComponent(blobName) };
};

const syncAttachmentToDynamics = async ({ token, dynamicsIncidentId, blobUrl, createdbyEmail }) => {
    try {
        const { base64, mimetype, filename } = await downloadBlobAsBase64(blobUrl);

        const payload = {
            subject:      filename,
            filename:     filename,
            mimetype:     mimetype,
            documentbody: base64,
            "objectid_incident@odata.bind": `/incidents(${dynamicsIncidentId})`,
        };

        let callerObjectId = null;
        if (createdbyEmail) {
            try {
                const userRes = await axios.get(
                    `${process.env.DYNAMICS_URL}/api/data/v9.2/systemusers?$filter=azureactivedirectoryobjectid eq '${createdbyEmail}'&$select=systemuserid,azureactivedirectoryobjectid`,
                    {
                        headers: {
                            Authorization:      `Bearer ${token}`,
                            Accept:             "application/json",
                            "OData-Version":    "4.0",
                            "OData-MaxVersion": "4.0",
                        }
                    }
                );
                callerObjectId = userRes.data.value?.[0]?.azureactivedirectoryobjectid ?? null;
            } catch {
                console.warn(`[DYNAMICS] Could not resolve user for impersonation: ${createdbyEmail}`);
            }
        }

        const headers = {
            ...dynamicsHeaders(token),
            ...(callerObjectId ? { "CallerObjectId": callerObjectId } : {}),
        };

        await axios.post(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations`,
            payload,
            { headers }
        );

        console.log(`[DYNAMICS] Attachment synced: ${filename} → incident ${dynamicsIncidentId}`);

    } catch (err) {
        console.error(`[DYNAMICS] Attachment sync failed for ${blobUrl}:`, err.response?.data ?? err.message);
    }
};

const create_Attachment = async (req, res) => {
    try {
        const { ticketuuid, attachments, createdby } = req.body;

        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
        const attachmentArray = toArray(attachments);

        const [result, token, dynamicsResult] = await Promise.all([
            client.query(
                "SELECT * FROM attachment_create($1, $2, $3)",
                [ticketuuid, attachmentArray, createdby]
            ),
            getDynamicsToken(),
            client.query(
                "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
                [ticketuuid]
            ),
        ]);

        const attachmentuuids = result.rows[0].attachment_create;
        res.status(201).json({ attachmentuuids });

        const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

        if (dynamicsIncidentId) {
            Promise.all(
                attachmentArray.map(blobUrl =>
                    syncAttachmentToDynamics({
                        token,
                        dynamicsIncidentId,
                        blobUrl,
                        createdbyEmail: createdby,
                    })
                )
            ).catch(err => console.error("[DYNAMICS] Attachment batch sync failed:", err.message));
        } else {
            console.warn(`[DYNAMICS] No dynamicsincidentid for ticketuuid: ${ticketuuid} — skipping attachment sync`);
        }

    } catch (err) {
        console.error("create_Attachment error:", err.message);
        if (err.message) return res.status(400).json({ error: err.message });
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

        return res.status(200).json({ attachmentuuids });
    } catch (err) {
        console.error("update_Attachment error:", err.message);
        if (err.message) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    get_Attachment,
    create_Attachment,
    update_Attachment,
};