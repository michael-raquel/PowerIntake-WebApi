/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Azure Blob Storage image upload and management endpoints
 */

/**
 * @swagger
 * /images/upload:
 *   post:
 *     summary: Upload an image to Azure Blob Storage
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload (jpeg, jpg, png, gif, webp, svg). Max size 10MB.
 *               name:
 *                 type: string
 *                 description: Optional custom name for the blob (spaces replaced with dashes). Defaults to a UUID if not provided.
 *                 example: "my-profile-picture"
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               url: "https://powerintake.blob.core.windows.net/images/my-profile-picture.jpg?sv=..."
 *               blobName: "my-profile-picture.jpg"
 *               size: 204800
 *               mimetype: "image/jpeg"
 *       400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             examples:
 *               noFile:
 *                 summary: No image file provided
 *                 value:
 *                   error: "No image file provided."
 *               invalidType:
 *                 summary: Invalid file type
 *                 value:
 *                   error: "Only image files are allowed (jpeg, jpg, png, gif, webp, svg)"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /images/upload/{blobName}:
 *   delete:
 *     summary: Delete an image from Azure Blob Storage
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blobName
 *         required: true
 *         schema:
 *           type: string
 *         description: The blob name of the image to delete
 *         example: "550e8400-e29b-41d4-a716-446655440000.jpg"
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Image deleted."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */