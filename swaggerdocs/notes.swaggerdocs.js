/**
 * @swagger
 * tags:
 *   name: Notes
 *   description: Notes management endpoints
 */

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Get all notes, filter by noteuuid or ticketuuid
 *     tags: [Notes]
 *     parameters:
 *       - in: query
 *         name: noteuuid
 *         schema:
 *           type: string
 *         required: false
 *         description: Note UUID (returns specific note if provided)
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *       - in: query
 *         name: ticketuuid
 *         schema:
 *           type: string
 *         required: false
 *         description: Ticket UUID (returns all notes for a specific ticket if provided)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: List of notes or a single note
 *         content:
 *           application/json:
 *             example:
 *               - noteuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 ticketuuid: "550e8400-e29b-41d4-a716-446655440000"
 *                 note: "This is a sample note content."
 *                 isactive: true
 *                 createdat: "2024-06-01T12:00:00Z"
 *                 createdby: "550e8400-e29b-41d4-a716-446655440000"
 *       500:
 *         description: Internal Server Error
 *
 *   post:
 *     summary: Create a new note
 *     tags: [Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketuuid
 *               - note
 *               - createdby
 *             properties:
 *               ticketuuid:
 *                 type: string
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               note:
 *                 type: string
 *                 example: "This is a new note."
 *               createdby:
 *                 type: string
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       201:
 *         description: Note created successfully
 *         content:
 *           application/json:
 *             example:
 *               noteuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *               ticketuuid: "550e8400-e29b-41d4-a716-446655440000"
 *               note: "This is a new note."
 *               isactive: true
 *               createdat: "2024-06-01T12:00:00Z"
 *               createdby: "550e8400-e29b-41d4-a716-446655440000"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /notes/{noteuuid}:
 *   put:
 *     summary: Update an existing note
 *     tags: [Notes]
 *     parameters:
 *       - in: path
 *         name: noteuuid
 *         schema:
 *           type: string
 *         required: true
 *         description: Note UUID to update
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note
 *               - modifiedby
 *             properties:
 *               note:
 *                 type: string
 *                 example: "This is an updated note."
 *               modifiedby:
 *                 type: string
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Note updated successfully
 *         content:
 *           application/json:
 *             example:
 *               noteuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *               ticketuuid: "550e8400-e29b-41d4-a716-446655440000"
 *               note: "This is an updated note."
 *               isactive: true
 *               modifiedat: "2024-06-01T13:00:00Z"
 *               modifiedby: "550e8400-e29b-41d4-a716-446655440000"
 *       500:
 *         description: Internal Server Error
 */