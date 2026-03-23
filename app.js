
//auragrabe

const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const setupSwagger = require('./swagger');
const cors = require('cors');

const app = express();

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());  
setupSwagger(app);        

const roles = require('./routes/roles.routes');
app.use('/roles', roles);

const images = require("./routes/images.routes");
app.use("/images", images);

const users = require("./routes/users.routes");
app.use("/users", users);

const manageusers = require("./routes/manageusers.routes");
app.use("/manageusers", manageusers);

const groups = require('./routes/groups.routes');
app.use('/groups', groups);

const tickets = require('./routes/tickets.routes');
app.use('/tickets', tickets);

const synctickets = require("./routes/synctickets.routes");
app.use("/synctickets", synctickets);

const usersettings = require('./routes/usersettings.routes');
app.use('/usersettings', usersettings);   

const attachments = require("./routes/attachments.routes");
app.use("/attachments", attachments);

const notes = require("./routes/notes.routes");
app.use("/notes", notes);




const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  // require('./controllers/scheduler');
});

module.exports = app;