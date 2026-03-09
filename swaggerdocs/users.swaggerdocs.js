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

/**
 * @swagger
 * /users/all-users-with-details:
 *   get:
 *     summary: Get all users with their manager, direct reports, groups, and roles
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of all users with complete details
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               users:
 *                 - id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *                   displayName: "Juan dela Cruz"
 *                   givenName: "Juan"
 *                   surname: "dela Cruz"
 *                   mail: "juan@spartaservices.com"
 *                   userPrincipalName: "juan@spartaservices.com"
 *                   jobTitle: "Software Engineer"
 *                   department: "Engineering"
 *                   officeLocation: "Makati"
 *                   mobilePhone: "09123456789"
 *                   businessPhones: ["02-1234567"]
 *                   preferredLanguage: "en-US"
 *                   accountEnabled: true
 *                   city: "Makati"
 *                   companyName: "Sparta Services"
 *                   country: "PH"
 *                   createdDateTime: "2024-01-01T00:00:00Z"
 *                   employeeId: "EMP001"
 *                   employeeType: "Employee"
 *                   usageLocation: "PH"
 *                   userType: "Member"
 *                   manager:
 *                     id: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
 *                     displayName: "Maria Santos"
 *                     mail: "maria@spartaservices.com"
 *                     jobTitle: "Engineering Manager"
 *                   directReports:
 *                     - id: "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
 *                       displayName: "Pedro Reyes"
 *                       mail: "pedro@spartaservices.com"
 *                       jobTitle: "Junior Developer"
 *                   groups:
 *                     - id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
 *                       displayName: "Engineering Team"
 *                       groupTypes: ["Unified"]
 *                       securityEnabled: true
 *                   roles:
 *                     - id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
 *                       displayName: "Global Administrator"
 *                       description: "Can manage all aspects of Azure AD"
 *                       roleTemplateId: "62e90394-69f5-4237-9190-012177145e10"
 *       500:
 *         description: Internal Server Error
 *       504:
 *         description: No response from Microsoft Graph (Timeout or Network Issue)
 */


/**
 * @swagger
 * /users/groups:
 *   get:
 *     summary: Get all groups a user belongs to (direct and transitive)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved user groups
 *         content:
 *           application/json:
 *             example:
 *               directGroups:
 *                 - id: "group-uuid-001"
 *                   displayName: "Engineering Team"
 *                   mail: "engineering@sparta.com"
 *                   groupTypes: ["Unified"]
 *                   securityEnabled: false
 *               transitiveGroups:
 *                 - id: "group-uuid-002"
 *                   displayName: "All Staff"
 *                   mail: "allstaff@sparta.com"
 *                   groupTypes: []
 *                   securityEnabled: true
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