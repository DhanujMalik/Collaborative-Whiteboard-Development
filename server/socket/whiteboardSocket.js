// server/socket/whiteboardSocket.js
const Room = require("../models/Room");

// Store active rooms and their users in memory for real-time tracking
const activeRooms = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join-room", async (roomId) => {
      try {
        socket.join(roomId);
        socket.roomId = roomId;

        // Initialize room in memory if it doesn't exist
        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, {
            users: new Set(),
            drawingData: []
          });
        }

        const room = activeRooms.get(roomId);
        room.users.add(socket.id);

        // Load existing drawing data from database
        const dbRoom = await Room.findOne({ roomId });
        if (dbRoom && dbRoom.drawingData.length > 0) {
          socket.emit("load-drawing", dbRoom.drawingData);
        }

        // Notify others that a user joined
        socket.broadcast.to(roomId).emit("user-joined");
        
        // Send current user count to all users in room
        io.to(roomId).emit("user-count", room.users.size);

        console.log(`User ${socket.id} joined room ${roomId}. Total users: ${room.users.size}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("error", "Failed to join room");
      }
    });

    socket.on("cursor-move", (data) => {
      if (socket.roomId) {
        // Throttle cursor updates by broadcasting to others only
        socket.broadcast.to(socket.roomId).emit("cursor-update", {
          id: socket.id,
          ...data,
        });
      }
    });

    socket.on("draw", async (data) => {
      if (socket.roomId) {
        // Broadcast drawing data to other users
        socket.broadcast.to(socket.roomId).emit("draw", data);

        // Store drawing commands in memory and database for persistence
        try {
          const room = activeRooms.get(socket.roomId);
          if (room && data.type === "start") {
            // Start a new stroke
            const drawingCommand = {
              type: "stroke",
              data: data,
              timestamp: new Date()
            };
            
            room.drawingData.push(drawingCommand);

            // Persist to database periodically (every 10 commands or on important events)
            if (room.drawingData.length % 10 === 0) {
              await saveRoomDrawingData(socket.roomId, room.drawingData);
            }
          }
        } catch (error) {
          console.error("Error saving drawing data:", error);
        }
      }
    });

    socket.on("clear-canvas", async () => {
      if (socket.roomId) {
        // Broadcast clear event to all users
        io.to(socket.roomId).emit("clear-canvas");

        // Clear drawing data from memory and database
        try {
          const room = activeRooms.get(socket.roomId);
          if (room) {
            room.drawingData = [];
            await saveRoomDrawingData(socket.roomId, []);
          }
        } catch (error) {
          console.error("Error clearing canvas data:", error);
        }
      }
    });

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.id}`);
      
      if (socket.roomId) {
        const room = activeRooms.get(socket.roomId);
        if (room) {
          room.users.delete(socket.id);
          
          // Notify others that user left
          socket.broadcast.to(socket.roomId).emit("user-left", socket.id);
          
          // Update user count
          io.to(socket.roomId).emit("user-count", room.users.size);

          // Save final state and clean up empty rooms
          if (room.users.size === 0) {
            try {
              await saveRoomDrawingData(socket.roomId, room.drawingData);
              activeRooms.delete(socket.roomId);
              console.log(`Room ${socket.roomId} cleaned up - no active users`);
            } catch (error) {
              console.error("Error cleaning up room:", error);
            }
          }
        }
      }
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Utility function to save drawing data to database
  async function saveRoomDrawingData(roomId, drawingData) {
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { 
          drawingData,
          lastActivity: new Date()
        },
        { upsert: true }
      );
      console.log(`Saved drawing data for room ${roomId}`);
    } catch (error) {
      console.error(`Error saving room data for ${roomId}:`, error);
    }
  }

  // Periodic cleanup of old rooms (run every hour)
  setInterval(async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await Room.deleteMany({
        lastActivity: { $lt: oneDayAgo }
      });
      if (result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} old rooms`);
      }
    } catch (error) {
      console.error("Error during room cleanup:", error);
    }
  }, 60 * 60 * 1000); // Run every hour
};