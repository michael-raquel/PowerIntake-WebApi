const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
dotenv.config();

const setupSwagger = require("./swagger");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin} is not allowed`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-webhook-secret"],
  }),
);

app.use("/tickets/dynamics/note", express.json({ limit: "50mb" })); 

app.use(express.json()); 
setupSwagger(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  socket.on("join", (entrauserid) => {
    socket.join(entrauserid);
    console.log(`[WS] ${entrauserid} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log("[WS] Client disconnected:", socket.id);
  });
});

const consent = require("./routes/consent.routes");
app.use("/consent", consent);

const roles = require("./routes/roles.routes");
app.use("/roles", roles);

const images = require("./routes/images.routes");
app.use("/images", images);

const users = require("./routes/users.routes");
app.use("/users", users);

const tenants = require("./routes/tenants.routes");
app.use("/tenants", tenants);

const manageusers = require("./routes/manageusers.routes");
app.use("/manageusers", manageusers);

const groups = require("./routes/groups.routes");
app.use("/groups", groups);

const tickets = require("./routes/tickets.routes");
app.use("/tickets", tickets);

const synctickets = require("./routes/synctickets.routes");
app.use("/synctickets", synctickets);

const usersettings = require("./routes/usersettings.routes");
app.use("/usersettings", usersettings);

const attachments = require("./routes/attachments.routes");
app.use("/attachments", attachments);

const notes = require("./routes/notes.routes");
app.use("/notes", notes);

const powersuiteailogs = require("./routes/powersuiteailogs.routes");
app.use("/powersuiteailogs", powersuiteailogs);

const technician = require("./routes/technician.routes");
app.use("/technicians", technician);

const ticketstatusswitcher = require("./routes/ticketstatusswitcher.routes");
app.use("/ticketstatusswitcher", ticketstatusswitcher);

const notifications = require("./routes/notifications.routes");
app.use("/notifications", notifications);

const openai = require("./routes/openai.routes");
app.use("/openai", openai);

const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  if (process.env.ENABLE_CRON.toLowerCase() === "true") {
    require("./controllers/scheduler");
    console.log("[CRON] Scheduler ENABLED");
  } else {
    console.log("[CRON] Scheduler DISABLED (local)");
  }
});

module.exports = { app, server, io };
