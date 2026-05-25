require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection, sequelize } = require('./config/db');
const employeeRoutes = require('./routes/employeeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // Allow all origins for development ease, restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local static file uploads if running fallback storage mode
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes mapping
app.use('/api/employees', employeeRoutes);

// Root route check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Employee Management System API is running.' });
});

// Startup sequence
const startServer = async () => {
  try {
    // 1. Verify DB Connection
    await testConnection();

    // 2. Sync database schema (Creates tables if they don't exist)
    // Using alter: true to handle mild development updates gracefully without wiping data
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized successfully.');

    // 3. Start Listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API Health Check at: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start the backend server:', error.message);
    process.exit(1);
  }
};

startServer();
