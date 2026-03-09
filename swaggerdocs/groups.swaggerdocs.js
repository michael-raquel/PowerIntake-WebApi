/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Microsoft 365 group management endpoints
 */

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: Get all groups
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Successfully retrieved all groups
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               groups:
 *                 - id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                   displayName: "Engineering Team"
 *                   description: "All engineers"
 *                   mail: "engineering@sparta.com"
 *                   mailEnabled: true
 *                   securityEnabled: false
 *                   groupTypes: ["Unified"]
 *                   createdDateTime: "2024-01-01T00:00:00Z"
 *                   visibility: "Public"
 *       504:
 *         description: Timeout or Network Issue
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/find:
 *   get:
 *     summary: Get a group by ID
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved group
 *         content:
 *           application/json:
 *             example:
 *               id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               displayName: "Engineering Team"
 *               description: "All engineers"
 *               mail: "engineering@sparta.com"
 *               mailEnabled: true
 *               securityEnabled: false
 *               groupTypes: ["Unified"]
 *               createdDateTime: "2024-01-01T00:00:00Z"
 *               visibility: "Public"
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/members:
 *   get:
 *     summary: Get members of a group
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved group members
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               members:
 *                 - id: "user-uuid-001"
 *                   displayName: "John Doe"
 *                   mail: "john.doe@sparta.com"
 *                   userPrincipalName: "john.doe@sparta.com"
 *                   jobTitle: "Software Engineer"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/owners:
 *   get:
 *     summary: Get owners of a group
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved group owners
 *         content:
 *           application/json:
 *             example:
 *               count: 1
 *               owners:
 *                 - id: "user-uuid-001"
 *                   displayName: "Jane Smith"
 *                   mail: "jane.smith@sparta.com"
 *                   userPrincipalName: "jane.smith@sparta.com"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/profile:
 *   get:
 *     summary: Get full profile of a group (group + members + owners)
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved full group profile
 *         content:
 *           application/json:
 *             example:
 *               group:
 *                 id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 displayName: "Engineering Team"
 *                 description: "All engineers"
 *                 mail: "engineering@sparta.com"
 *               members:
 *                 - id: "user-uuid-001"
 *                   displayName: "John Doe"
 *                   mail: "john.doe@sparta.com"
 *                   jobTitle: "Software Engineer"
 *               owners:
 *                 - id: "user-uuid-002"
 *                   displayName: "Jane Smith"
 *                   mail: "jane.smith@sparta.com"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/with-members:
 *   get:
 *     summary: Get all groups with their members and owners
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Successfully retrieved all groups with members and owners
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               groups:
 *                 - id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                   displayName: "Engineering Team"
 *                   memberCount: 2
 *                   members:
 *                     - id: "user-uuid-001"
 *                       displayName: "John Doe"
 *                       mail: "john.doe@sparta.com"
 *                       jobTitle: "Software Engineer"
 *                       department: "Engineering"
 *                   owners:
 *                     - id: "user-uuid-002"
 *                       displayName: "Jane Smith"
 *                       mail: "jane.smith@sparta.com"
 *       504:
 *         description: Timeout or Network Issue
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */