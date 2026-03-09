const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const setupSwagger = require('./swagger');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
setupSwagger(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); 
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin} is not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const systemadmin = require("./routes/systemadmin.routes");
app.use("/systemadmin", systemadmin);

const users = require("./routes/users.routes");
app.use("/users", users);

<<<<<<< Updated upstream
=======
const groups = require('./routes/groups.routes');
app.use('/groups', groups);

const tickets = require('./routes/tickets.routes');
app.use('/tickets', tickets);

const notes = require("./routes/notes.routes");
app.use("/notes", notes);

>>>>>>> Stashed changes
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});

module.exports = app;

