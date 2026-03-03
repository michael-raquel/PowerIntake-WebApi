const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db'); 
const setupSwagger = require('./swagger');

dotenv.config();

const app = express();
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM systemadmin');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

setupSwagger(app);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});