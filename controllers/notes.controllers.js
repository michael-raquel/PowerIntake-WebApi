const client = require("../config/db");

const get_Note = async (req, res) => {
  try {
    const { noteuuid, ticketuuid } = req.query;

    const result = await client.query("SELECT * FROM note_get($1, $2)", [
      noteuuid || null,
      ticketuuid || null,
    ]);

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};


const create_Note = async (req, res) => {
    try {
        const { ticketuuid, note, createdby } = req.body;

        const result = await client.query(
            "SELECT * FROM note_create($1, $2, $3)",
            [ticketuuid, note, createdby]
        );

        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).send("Internal Server Error");
    }
};


const update_Note = async (req, res) => {
    try {
        const { noteuuid } = req.params;
        const { note, modifiedby } = req.body;

        const result = await client.query(
            "SELECT * FROM note_update($1, $2, $3)",
            [noteuuid, note, modifiedby]
        );

        res.status(200).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).send("Internal Server Error");
    }
};


module.exports = {
  get_Note,
  create_Note,
  update_Note
};
