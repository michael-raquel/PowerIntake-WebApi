const client = require("../config/db");

const get_user_from_my_company = async (req, res) => {
  try {
    const page  = req.query.page  || '1';
    const limit = req.query.limit || '10';

    const result = await client.query(
      'SELECT * FROM user_get_my_company($1, $2)',
      [page, limit]
    );

    const rows = result.rows;
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json({
      data: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1,
    });

  } catch (err) {
    
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
    get_user_from_my_company
};