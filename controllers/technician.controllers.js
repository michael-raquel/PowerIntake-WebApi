const client = require("../config/db");

const get_technician = async (req, res) => {
  try {
    
   const { ticketuuid } = req.query;

    const result = await client.query(
    `SELECT * FROM public.tickettechnician_get($1)`,
    [ticketuuid || null]
    );


    return res.status(200).json(result.rows);

  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { get_technician };