const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const upload = require('../middleware/upload');

// Dashboard statistics (Must be defined before :id route)
router.get('/stats', employeeController.getDashboardStats);

// Get all employees (Search, filter, paginate)
router.get('/', employeeController.getAllEmployees);

// Get single employee by ID
router.get('/:id', employeeController.getEmployeeById);

// Create employee (Handles file uploads)
router.post('/', upload, employeeController.createEmployee);

// Update employee (Handles optional file updates)
router.put('/:id', upload, employeeController.updateEmployee);

// Delete employee
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
