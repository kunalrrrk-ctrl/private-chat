require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Automatically create database table
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => console.log('Database ready'))
  .catch(err => console.error('DB Init Error:', err));

app.use(express.static('public'));

// Real-Time Socket Connections
io.on('connection', async (socket) => {
  try {
    const res = await pool.query('SELECT sender, text FROM messages ORDER BY created_at ASC LIMIT 50');
    socket.emit('load history', res.rows);
  } catch (err) {
    console.error('Error fetching history:', err);
  }

  socket.on('chat message', async (data) => {
    try {
      await pool.query('INSERT INTO messages (sender, text) VALUES ($1, $2)', [data.sender, data.text]);
      io.emit('chat message', data);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));