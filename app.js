const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const setupSwagger = require('./swagger');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
setupSwagger(app);

const systemadmin = require("./routes/systemadmin.routes");
app.use("/systemadmin", systemadmin);

const users = require("./routes/users.routes");
app.use("/users", users);

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});

module.exports = app; //testswss