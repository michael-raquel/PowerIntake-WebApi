const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

function getJwksClient(tenantId) {
  return jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  });
}

function getKey(header, tenantId, callback) {
  const client = getJwksClient(tenantId);
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  const decoded = jwt.decode(token, { complete: true });

  if (!decoded?.payload?.tid) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid token structure" });
  }

  const tenantId = decoded.payload.tid;

  jwt.verify(
    token,
    (header, callback) => getKey(header, tenantId, callback),
    {
      audience: process.env.AZURE_API_AUDIENCE,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      algorithms: ["RS256"],
    },
    (err, decodedToken) => {
      if (err) {
        console.error("Token validation failed:", err.message);
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
      }
      req.user = decodedToken;
      req.tenantId = tenantId;
      next();
    },
  );
};

module.exports = validateToken;
