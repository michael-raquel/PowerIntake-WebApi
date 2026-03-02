const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const setupSwagger = require("./swagger");

const app = express();

setupSwagger(app);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});