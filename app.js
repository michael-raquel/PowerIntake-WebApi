const express = require('express');
const dotenv = require('dotenv');
const setupSwagger = require('./swagger');

dotenv.config();

const app = express();

setupSwagger(app);
app.use(express.json());

const systemadmin = require("./routes/systemadmin.routes");
app.use("/systemadmin", systemadmin);

const users = require("./routes/users.routes");
app.use("/users", users);

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});

module.exports = app; //tests