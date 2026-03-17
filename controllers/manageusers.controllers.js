const client = require("../config/db");

const get_user_from_my_company = async (req, res) => {
  try {
    const page           = req.query.page           || '1';
    const limit          = req.query.limit          || '12';
    const entratenantid  = req.query.entratenantid  || null;
    const search         = req.query.search         || null;
    const manager        = req.query.manager        || null;
    const role           = req.query.role           || null;
    const department     = req.query.department     || null;
    const status         = req.query.status         || null;

    if (!entratenantid) {
      return res.status(400).json({ error: 'entratenantid is required' });
    }

    const result = await client.query(
      'SELECT * FROM user_get_my_company($1,$2,$3,$4,$5,$6,$7,$8)',
      [page, limit, entratenantid, search, manager, role, department, status]
    );

    const rows       = result.rows;
    const total      = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json({
      data: rows,
      total,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    });

  } catch (err) {
    console.error('get_user_from_my_company error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


const get_user_from_my_team = async (req, res) => {
  try {
    const { entrauserid }      = req.query;
    const page       = req.query.page       || '1';
    const limit      = req.query.limit      || '12';
    const search     = req.query.search     || null;
    const status     = req.query.status     || null;

    if (!entrauserid) {
      return res.status(400).json({ error: "entrauserid is required" });
    }

    const result = await client.query(
      'SELECT * FROM user_get_my_team($1, $2, $3, $4, $5)',
      [entrauserid, page, limit, search, status]
    );

    const rows       = result.rows;
    const total      = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json({
      data:      rows,
      total,
      page:      parseInt(page),
      limit:     parseInt(limit),
      totalPages,
      hasNext:   parseInt(page) < totalPages,
      hasPrev:   parseInt(page) > 1,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const get_user_super_admin = async (req, res) => {
  try {
    const page   = req.query.page   || '1';
    const limit  = req.query.limit  || '12';
    const search = req.query.search || null;
    const role   = req.query.role   || null;
    const status = req.query.status || null;

    const result = await client.query(
      'SELECT * FROM public.user_get_super_admin($1,$2,$3,$4,$5)',
      [page, limit, search, role, status]
    );

    const rows       = result.rows;
    const total      = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json({
      data: rows,
      total,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    });

  } catch (err) {
    console.error('get_user_super_admin error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const manager_check = async (req, res) => {
    try {

        const { entrauserid } = req.query;
        const result = await client.query(
            "SELECT * FROM user_manager_check($1)",
            [entrauserid]
        );

        res.status(200).json(result.rows[0]);

    } catch (err) {

        res.status(500).json({ error: "Internal Server Error" });
    }
}


module.exports = {
  get_user_from_my_company,
  get_user_from_my_team,
  get_user_super_admin,
  manager_check,
};