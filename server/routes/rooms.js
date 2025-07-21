// server/routes/rooms.js
const express = require("express");
const router = express.Router();
const Room = require("../models/Room");

// Generate random room code
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Join or create a room
router.post("/join", async (req, res) => {
  try {
    const { roomId } = req.body;
    
    if (!roomId || roomId.trim().length === 0) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const normalizedRoomId = roomId.trim().toUpperCase();
    
    // Check if room exists
    let room = await Room.findOne({ roomId: normalizedRoomId });
    
    if (!room) {
      // Create new room
      room = new Room({ 
        roomId: normalizedRoomId,
        createdAt: new Date(),
        lastActivity: new Date(),
        drawingData: []
      });
      await room.save();
      console.log(`Created new room: ${normalizedRoomId}`);
    } else {
      // Update last activity
      room.lastActivity = new Date();
      await room.save();
      console.log(`Joined existing room: ${normalizedRoomId}`);
    }

    res.json({
      roomId: room.roomId,
      created: new Date() - room.createdAt < 1000, // Room was just created
      hasDrawingData: room.drawingData && room.drawingData.length > 0
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new room with auto-generated code
router.post("/create", async (req, res) => {
  try {
    let roomId;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique room code
    do {
      roomId = generateRoomCode();
      attempts++;
      
      if (attempts > maxAttempts) {
        return res.status(500).json({ error: "Could not generate unique room code" });
      }
    } while (await Room.findOne({ roomId }));

    // Create room
    const room = new Room({
      roomId,
      createdAt: new Date(),
      lastActivity: new Date(),
      drawingData: []
    });

    await room.save();
    console.log(`Created new room with generated code: ${roomId}`);

    res.json({
      roomId: room.roomId,
      created: true
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get room information
router.get("/:roomId", async (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Update last activity
    room.lastActivity = new Date();
    await room.save();

    res.json({
      roomId: room.roomId,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      hasDrawingData: room.drawingData && room.drawingData.length > 0,
      drawingCommandCount: room.drawingData ? room.drawingData.length : 0
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get room statistics (optional endpoint for debugging)
router.get("/:roomId/stats", async (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = await Room.findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const stats = {
      roomId: room.roomId,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      totalDrawingCommands: room.drawingData ? room.drawingData.length : 0,
      roomAge: new Date() - room.createdAt,
      lastActiveAgo: new Date() - room.lastActivity
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching room stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;