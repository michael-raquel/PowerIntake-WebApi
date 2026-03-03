const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db'); 
const setupSwagger = require('./swagger');

dotenv.config();

const app = express();

setupSwagger(app);
app.use(express.json());

const systemadmin = require("./routes/systemadmin.routes");
app.use("/systemadmin", systemadmin);

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});