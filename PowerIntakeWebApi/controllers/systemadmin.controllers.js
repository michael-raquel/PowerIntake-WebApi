const client = require("../config/db");

const get_SystemAdmin = async (req, res) => {
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

const create_SystemAdmin = async (req, res) => {
    try {
        const { firstname, lastname, email, contactnumber
            , gender, birthdate, city, barangay, createdby } = req.body;

        const result = await client.query(
            "SELECT * FROM systemadmin_create($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [firstname, lastname, email, contactnumber, gender, birthdate, city, barangay, createdby]
        );

        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).send("Internal Server Error");
    }
};

const update_SystemAdmin = async (req, res) => {
    try {
        const { systemadminuuid } = req.query;
        const { firstname, lastname, email, contactnumber,
            gender, birthdate, city, barangay, isactive, modifiedby } = req.body;

        const result = await client.query(
            "SELECT * FROM systemadmin_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            [systemadminuuid, firstname, lastname, email, contactnumber, gender, birthdate, city, barangay, isactive, modifiedby]
        );

        res.status(200).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).send("Internal Server Error");
    }
};


module.exports = {
    get_SystemAdmin,
    create_SystemAdmin,
    update_SystemAdmin
};