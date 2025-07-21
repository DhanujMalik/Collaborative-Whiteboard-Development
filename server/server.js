// server/server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // adjust for production
  },
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Routes
app.use("/api/rooms", require("./routes/rooms"));

// Socket Setup
require("./socket/whiteboardSocket")(io);

server.listen(5000, () => console.log("Server listening on port 5000"));
