/**
 * @swagger
 * tags:
 *   name: System Admin
 *   description: System administrator management endpoints
 */

/**
 * @swagger
 * /systemadmin:
 *   get:
 *     summary: Get system administrators or a specific system administrator by systemadminuuid
 *     tags: [System Admin]
 *     parameters:
 *       - in: query
 *         name: systemadminuuid
 *         schema:
 *           type: string
 *         required: false
 *         description: System Admin UUID (returns specific record if provided, otherwise returns empty if not handled)
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *     responses:
 *       200:
 *         description: List of system administrators or a single system administrator
 *         content:
 *           application/json:
 *             example:
 *               - systemadminuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 firstname: "John"
 *                 lastname: "Doe"
 *                 email: "john.doe@example.com"
 *                 contactnumber: "09123456789"
 *                 gender: "Male"
 *                 birthdate: "1990-01-01"
 *                 city: "Makati"
 *                 barangay: "Bel-Air"
 *                 isactive: true
 *                 createdat: "2024-06-01T12:00:00Z"
 *                 createdby: "550e8400-e29b-41d4-a716-446655440000"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /systemadmin:
 *   post:
 *     summary: Create a new system administrator
 *     tags: [System Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             firstname: "John"
 *             lastname: "Doe"
 *             email: "john.doe@example.com"
 *             contactnumber: "09123456789"
 *             gender: "Male"
 *             birthdate: "1990-01-01"
 *             city: "Makati"
 *             barangay: "Bel-Air"
 *             createdby: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       201:
 *         description: Successfully created, returns new system admin UUID
 *         content:
 *           application/json:
 *             example:
 *               systemadminuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /systemadmin:
 *   put:
 *     summary: Update an existing system administrator
 *     tags: [System Admin]
 *     parameters:
 *       - in: query
 *         name: systemadminuuid
 *         schema:
 *           type: string
 *         required: true
 *         description: UUID of the system administrator to update
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             firstname: "John"
 *             lastname: "Doe"
 *             email: "john.doe@example.com"
 *             contactnumber: "09123456789"
 *             gender: "Male"
 *             birthdate: "1990-01-01"
 *             city: "Makati"
 *             barangay: "Bel-Air"
 *             isactive: "true"
 *             modifiedby: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Successfully updated, returns updated record
 *         content:
 *           application/json:
 *             example:
 *               systemadminuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *               firstname: "John"
 *               lastname: "Doe"
 *               email: "john.doe@example.com"
 *               contactnumber: "09123456789"
 *               gender: "Male"
 *               birthdate: "1990-01-01"
 *               city: "Makati"
 *               barangay: "Bel-Air"
 *               isactive: "true"
 *               modifiedat: "2024-06-01T12:00:00Z"
 *               modifiedby: "550e8400-e29b-41d4-a716-446655440000"
 *       500:
 *         description: Internal Server Error
 */