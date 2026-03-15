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

/**
 * @swagger
 * /users/app-role-assignments:
 *   get:
 *     summary: Get app role assignments of a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Azure AD User ID
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved app role assignments
 *         content:
 *           application/json:
 *             example:
 *               count: 1
 *               appRoleAssignments:
 *                 - id: "uuid-here"
 *                   appRoleId: "abc123-..."
 *                   resourceId: "uuid-here"
 *                   resourceDisplayName: "powerintake"
 *                   principalId: "9e6f25b6-..."
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
 * /users/sync:
 *   post:
 *     summary: Sync Microsoft Entra ID users to the database (My Company Only)
 *     description: Fetches all users from Microsoft Graph API and upserts them into the database using email as the unique identifier. New users are inserted, existing users are updated.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Sync with results
 *                 value:
 *                   message: "Sync completed."
 *                   total: 42
 *                   synced: 40
 *                   skipped: 2
 *               noUsers:
 *                 summary: No users found in Graph
 *                 value:
 *                   message: "No users found in Microsoft Graph."
 *                   synced: 0
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
 * /users/sync-all-tenants:
 *   post:
 *     summary: Sync Microsoft Entra ID users across all configured tenants
 *     description: Fetches all tenants from the database, authenticates against each tenant using their stored credentials, then syncs all users into the database. Only new users are inserted. Skips tenants with no credentials configured.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Multi-tenant sync completed
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Sync with results across tenants
 *                 value:
 *                   message: "Multi-tenant sync completed."
 *                   total_tenants: 3
 *                   results:
 *                     - tenant: "Housing Co A"
 *                       total: 50
 *                       new: 5
 *                       synced: 5
 *                       skipped: 0
 *                     - tenant: "Housing Co B"
 *                       total: 30
 *                       new: 0
 *                       message: "All users already synced."
 *                     - tenant: "Housing Co C"
 *                       total: 20
 *                       message: "No users found."
 *                       synced: 0
 *               noTenants:
 *                 summary: No tenants configured
 *                 value:
 *                   message: "No tenants configured with credentials."
 *               tenantError:
 *                 summary: One tenant failed but others succeeded
 *                 value:
 *                   message: "Multi-tenant sync completed."
 *                   total_tenants: 3
 *                   results:
 *                     - tenant: "Housing Co A"
 *                       total: 50
 *                       new: 5
 *                       synced: 5
 *                       skipped: 0
 *                     - tenant: "Housing Co B"
 *                       error: "Invalid client secret"
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