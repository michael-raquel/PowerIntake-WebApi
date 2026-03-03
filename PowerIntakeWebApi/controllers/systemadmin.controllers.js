const client = require("../config/db");

const getSystemAdmin = async (req, res) => {
    try {

    const { systemadminuuid } = req.query;

      const result = await client.query(
        "SELECT * FROM systemadmin_get($1)",
        [systemadminuuid || null]
        );

      res.status(200).json(result.rows);
    }
    catch (err) {
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    getSystemAdmin
};