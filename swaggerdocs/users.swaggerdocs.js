/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Microsoft Active Directory user management endpoints
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users in the organization
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               users:
 *                 - id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *                   displayName: "Juan dela Cruz"
 *                   mail: "juan@spartaservices.com"
 *                   jobTitle: "Software Engineer"
 *                   department: "Engineering"
 *                   officeLocation: "Makati"
 *                   mobilePhone: "09123456789"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get a single user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Azure AD User ID
 *         example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             example:
 *               id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *               displayName: "Juan dela Cruz"
 *               mail: "juan@spartaservices.com"
 *               jobTitle: "Software Engineer"
 *               department: "Engineering"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /users/manager:
 *   get:
 *     summary: Get a user's manager
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Azure AD User ID
 *         example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *     responses:
 *       200:
 *         description: Manager details
 *         content:
 *           application/json:
 *             example:
 *               displayName: "Maria Santos"
 *               mail: "maria@spartaservices.com"
 *               jobTitle: "Engineering Manager"
 *       404:
 *         description: No manager found for this user
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /users/direct-reports:
 *   get:
 *     summary: Get direct reports of a user
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Azure AD User ID
 *         example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *     responses:
 *       200:
 *         description: List of direct reports
 *         content:
 *           application/json:
 *             example:
 *               count: 1
 *               directReports:
 *                 - displayName: "Pedro Reyes"
 *                   mail: "pedro@spartaservices.com"
 *                   jobTitle: "Junior Developer"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /users/full-profile:
 *   get:
 *     summary: Get user + manager + direct reports in one call
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Azure AD User ID
 *         example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *     responses:
 *       200:
 *         description: Full profile with manager and direct reports
 *         content:
 *           application/json:
 *             example:
 *               user:
 *                 displayName: "Juan dela Cruz"
 *                 mail: "juan@spartaservices.com"
 *                 jobTitle: "Software Engineer"
 *               manager:
 *                 displayName: "Maria Santos"
 *                 mail: "maria@spartaservices.com"
 *               directReports:
 *                 - displayName: "Pedro Reyes"
 *                   mail: "pedro@spartaservices.com"
 *       500:
 *         description: Internal Server Error
 */