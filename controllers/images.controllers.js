const multer = require("multer");
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || "images";
const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp, svg)"));
  },
});

const generateSasUrl = (blobName) => {
  const sharedKeyCredential = new StorageSharedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);

  const sasOptions = {
    containerName: CONTAINER_NAME,
    blobName,
    permissions: BlobSASPermissions.parse("r"), // read-only
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 365 * 24 * 60 * 60 * 1000), // 1 year
  };

  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
  return `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sasToken}`;
};


const upload_Image = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    await containerClient.createIfNotExists();

    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const baseName = req.body.name ? req.body.name.trim().replace(/\s+/g, "-") : uuidv4();
    const blobName = `${baseName}${ext}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    const imageUrl = generateSasUrl(blobName);

    return res.status(201).json({
      success: true,
      url: imageUrl,
      blobName,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    console.error("upload_Image error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

const delete_Image = async (req, res) => {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(req.params.blobName);

    await blockBlobClient.deleteIfExists();

    return res.status(200).json({ success: true, message: "Image deleted." });
  } catch (err) {
    console.error("delete_Image error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};


const download_Image = async (req, res) => {
  try {
    const { blobName } = req.params;
    const decodedBlobName = decodeURIComponent(blobName);
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(decodedBlobName);
    
    const exists = await blockBlobClient.exists();
    if (!exists) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const properties = await blockBlobClient.getProperties();
    const contentType = properties.contentType || 'application/octet-stream';
    
    const downloadResponse = await blockBlobClient.download(0);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(decodedBlobName)}"`);
    res.setHeader('Content-Length', properties.contentLength);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    downloadResponse.readableStreamBody.pipe(res);
  } catch (err) {
    console.error("download_Image error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  upload,
  upload_Image,
  delete_Image,
  download_Image,
};