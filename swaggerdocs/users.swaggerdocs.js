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
 * /users/db:
 *   get:
 *     summary: Get users from the database
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: useruuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by user UUID
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *       - in: query
 *         name: entrauserid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Entra user ID
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       - in: query
 *         name: tenantuuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by tenant UUID
 *         example: "1159156a-3971-429d-bb02-bd37b1223d24"
 *     responses:
 *       200:
 *         description: Successfully retrieved users
 *         content:
 *           application/json:
 *             example:
 *               - v_userid: 1
 *                 v_useruuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 v_entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *                 v_tenantname: "Sparta Services LLC"
 *                 v_entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_username: "Juan dela Cruz"
 *                 v_userrole: "Employee"
 *                 v_jobtitle: "Software Engineer"
 *                 v_businessphone: "02-1234567"
 *                 v_createddate: "2026-01-01T09:00:00Z"
 *                 v_useremail: "juan@spartaservices.com"
 *                 v_department: "Engineering"
 *                 v_managerid: 2
 *                 v_managername: "Maria Santos"
 *                 v_mobilephone: "09123456789"
 *                 v_createdat: "2026-01-01T09:00:00Z"
 *                 v_createdby: "system"
 *                 v_modifiedat: null
 *                 v_modifiedby: null
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /users/user-info:
 *   get:
 *     summary: Get user info by Entra user ID from the database
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: entrauserid
 *         required: true
 *         schema:
 *           type: string
 *         description: Microsoft Entra user ID
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved user info
 *         content:
 *           application/json:
 *             example:
 *               - useruuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 username: "Juan dela Cruz"
 *                 useremail: "juan@spartaservices.com"
 *                 userrole: "User"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "entrauserid is required"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /users/role:
 *   put:
 *     summary: Update a user's role in the database
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             userrole: "Admin"
 *             modifiedby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully updated user role
 *         content:
 *           application/json:
 *             example:
 *               useruuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: User with EntraUserID aabbccdd-1234-5678-abcd-ef1234567890 does not exist."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
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
 * /users/all-users-with-security-groups:
 *   get:
 *     summary: Get all users with security group memberships
 *     description: Returns each user with manager, direct reports, direct groups, transitive groups, roles, and security-enabled groups.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of all users with security groups
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               users:
 *                 - id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *                   displayName: "Juan dela Cruz"
 *                   mail: "juan@spartaservices.com"
 *                   manager:
 *                     id: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
 *                     displayName: "Maria Santos"
 *                   directReports:
 *                     - id: "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
 *                       displayName: "Pedro Reyes"
 *                   groups:
 *                     - id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
 *                       displayName: "Engineering Team"
 *                       groupTypes: ["Unified"]
 *                       securityEnabled: true
 *                   transitiveGroups:
 *                     - id: "cccccccc-cccc-cccc-cccc-cccccccccccc"
 *                       displayName: "All Staff"
 *                       groupTypes: []
 *                       securityEnabled: true
 *                   roles:
 *                     - id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
 *                       displayName: "Global Administrator"
 *                       description: "Can manage all aspects of Azure AD"
 *                       roleTemplateId: "62e90394-69f5-4237-9190-012177145e10"
 *                   securityGroups:
 *                     - id: "dddddddd-dddd-dddd-dddd-dddddddddddd"
 *                       displayName: "IT Security"
 *                       groupTypes: []
 *                       securityEnabled: true
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
 *   post:
 *     summary: Create a Microsoft Entra group
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             tenantId: "1159156a-3971-429d-bb02-bd37b1223d24"
 *             displayName: "Engineering Team"
 *             mailNickname: "engineering-team"
 *             mailEnabled: false
 *             securityEnabled: true
 *             groupTypes: []
 *             description: "Engineering security group"
 *             ownerOids:
 *               - "aabbccdd-1234-5678-abcd-ef1234567890"
 *             memberOids:
 *               - "11223344-5566-7788-99aa-bbccddeeff00"
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             example:
 *               id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
 *               displayName: "Engineering Team"
 *               mailNickname: "engineering-team"
 *               mailEnabled: false
 *               securityEnabled: true
 *               groupTypes: []
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "displayName and mailNickname are required"
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
 *     description: Fetches all users from Microsoft Graph API and upserts them into the database using email as the unique identifier. New users are inserted, existing users are updated. Users with no assigned role default to "User".
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Sync with new users
 *                 value:
 *                   message: "Sync completed."
 *                   total: 149
 *                   new: 10
 *                   synced: 9
 *                   skipped: 1
 *                   managersResolved: 8
 *                   managersFailed: 1
 *               alreadySynced:
 *                 summary: All users already synced
 *                 value:
 *                   message: "All users are already synced."
 *                   total: 149
 *                   synced: 0
 *                   skipped: 149
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
 * /users/login-sync:
 *   post:
 *     summary: Create user in the database on first login
 *     description: Uses JWT claims to create the user if it does not exist and returns existing user data if already present.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User created or already exists
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 summary: User created on first login
 *                 value:
 *                   message: "User created on login"
 *                   user:
 *                     entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                     username: "Juan dela Cruz"
 *                     useremail: "juan@spartaservices.com"
 *                     userrole: "User"
 *               existing:
 *                 summary: User already exists
 *                 value:
 *                   message: "User already exists"
 *                   user:
 *                     entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                     username: "Juan dela Cruz"
 *                     useremail: "juan@spartaservices.com"
 *                     userrole: "User"
 *       400:
 *         description: Invalid token payload
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid token: missing user or tenant ID"
 *       403:
 *         description: Tenant is not registered
 *         content:
 *           application/json:
 *             example:
 *               error: "Access denied: your organization is not registered in this system."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
