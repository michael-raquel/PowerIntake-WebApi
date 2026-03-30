const client = require("../config/db");
const axios  = require("axios"); 
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

// const syncAttachmentToDynamics = async ({ token, dynamicsIncidentId, blobUrl, createdbyEmail }) => {
//     try {
//         const { base64, mimetype, filename } = await downloadBlobAsBase64(blobUrl);

//         const payload = {
//             subject:      filename,
//             filename:     filename,
//             mimetype:     mimetype,
//             documentbody: base64,
//             "objectid_incident@odata.bind": `/incidents(${dynamicsIncidentId})`,
//         };

//         let callerObjectId = null;
//         if (createdbyEmail) {
//             try {
//                 const userRes = await axios.get(
//                     `${process.env.DYNAMICS_URL}/api/data/v9.2/systemusers?$filter=azureactivedirectoryobjectid eq '${createdbyEmail}'&$select=systemuserid,azureactivedirectoryobjectid`,
//                     {
//                         headers: {
//                             Authorization:      `Bearer ${token}`,
//                             Accept:             "application/json",
//                             "OData-Version":    "4.0",
//                             "OData-MaxVersion": "4.0",
//                         }
//                     }
//                 );
//                 callerObjectId = userRes.data.value?.[0]?.azureactivedirectoryobjectid ?? null;
//             } catch {
//                 console.warn(`[DYNAMICS] Could not resolve user for impersonation: ${createdbyEmail}`);
//             }
//         }

//         const headers = {
//             ...dynamicsHeaders(token),
//             ...(callerObjectId ? { "CallerObjectId": callerObjectId } : {}),
//         };

//         await axios.post(
//             `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations`,
//             payload,
//             { headers }
//         );

//         console.log(`[DYNAMICS] Attachment synced: ${filename} → incident ${dynamicsIncidentId}`);

//     } catch (err) {
//         console.error(`[DYNAMICS] Attachment sync failed for ${blobUrl}:`, err.response?.data ?? err.message);
//     }
// };

const syncAttachmentToDynamics = async ({ token, dynamicsIncidentId, blobUrl }) => {
    try {
        const { base64, mimetype, filename } = await downloadBlobAsBase64(blobUrl);

        const payload = {
            subject:      filename,
            filename:     filename,
            mimetype:     mimetype,
            documentbody: base64,
            "objectid_incident@odata.bind": `/incidents(${dynamicsIncidentId})`,
        };

        const response = await axios.post(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations`,
            payload,
            { headers: dynamicsHeaders(token) }
        );

        const entityUrl = response.headers["odata-entityid"] || response.headers["OData-EntityId"];
        let annotationid = null;
        if (entityUrl) {
            const match = entityUrl.match(/\(([^)]+)\)/);
            annotationid = match ? match[1] : null;
        }

        // console.log(`[DYNAMICS] Attachment synced: ${filename} → incident ${dynamicsIncidentId}, annotationid: ${annotationid}`);

        return annotationid; 

    } catch (err) {
        console.error(`[DYNAMICS] Attachment sync failed for ${blobUrl}:`, err.response?.data ?? err.message);
        return null;
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
                    syncAttachmentToDynamics({ token, dynamicsIncidentId, blobUrl })
                )
            ).then(async (annotationIds) => {
                
                for (let i = 0; i < attachmentArray.length; i++) {
                    const annotationid = annotationIds[i];
                    const blobUrl      = attachmentArray[i];
                    if (!annotationid) continue;

                    try {
                        await client.query(
                            `SELECT public.attachment_update_annotation($1, $2)`,
                            [blobUrl, annotationid]
                        );
                        console.log(`[DYNAMICS] Attachment annotationid saved: ${annotationid}`);
                    } catch (e) {
                        console.error(`[DYNAMICS] Failed to save annotationid for ${blobUrl}:`, e.message);
                    }
                }
            }).catch(err => console.error("[DYNAMICS] Attachment batch sync failed:", err.message));
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
        const { ticketuuid, attachments, newAttachments, removedAnnotationIds, modifiedby } = req.body;
        console.log("[ATTACHMENT] removedAnnotationIds received:", removedAnnotationIds);
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];

        const attachmentArray        = toArray(attachments);
        const newAttachmentArray     = toArray(newAttachments);
        const removedAnnotationArray = toArray(removedAnnotationIds); 

        const [result, token, dynamicsResult] = await Promise.all([
            client.query(
                "SELECT * FROM attachment_update($1, $2, $3)",
                [ticketuuid, attachmentArray, modifiedby]
            ),
            getDynamicsToken(),
            client.query(
                "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
                [ticketuuid]
            ),
        ]);

        const attachmentuuids    = result.rows[0].attachment_update;
        const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

        res.status(200).json({ attachmentuuids });

        if (dynamicsIncidentId) {

            if (removedAnnotationArray.length > 0) {
                for (const annotationid of removedAnnotationArray) {
                    try {
                        await axios.delete(
                            `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations(${annotationid})`,
                            { headers: dynamicsHeaders(token) }
                        );
                        console.log(`[DYNAMICS] Annotation deleted: ${annotationid}`);
                    } catch (err) {
                        console.error(`[DYNAMICS] Failed to delete annotation ${annotationid}:`, err.response?.data ?? err.message);
                    }
                }
            }

           if (newAttachmentArray.length > 0) {
                for (const blobUrl of newAttachmentArray) {
                    try {
                        const annotationid = await syncAttachmentToDynamics({ token, dynamicsIncidentId, blobUrl });

                        if (annotationid) {
                            await client.query(
                                `SELECT public.attachment_update_annotation($1, $2)`,
                                [blobUrl, annotationid]
                            );
                            console.log(`[DYNAMICS] Attachment annotationid saved: ${annotationid}`);
                        }
                    } catch (err) {
                        console.error("[DYNAMICS] Attachment sync failed:", blobUrl, err.response?.data ?? err.message);
                    }
                }
            }

        } else {
            console.warn(`[DYNAMICS] No incident id for ticketuuid: ${ticketuuid} — skipping`);
        }

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