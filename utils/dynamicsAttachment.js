const axios = require("axios");
const { BlobServiceClient } = require("@azure/storage-blob");
const { dynamicsHeaders } = require("./dynamicsHelpers");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME    = process.env.AZURE_STORAGE_CONTAINER || "images";

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

        await axios.post(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations`,
            payload,
            { headers: dynamicsHeaders(token) }
        );

        console.log(`[DYNAMICS] Attachment synced: ${filename} → incident ${dynamicsIncidentId}`);
    } catch (err) {
        console.error(`[DYNAMICS] Attachment sync failed for ${blobUrl}:`, err.response?.data ?? err.message);
    }
};

module.exports = { downloadBlobAsBase64, syncAttachmentToDynamics };