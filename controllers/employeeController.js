const Employee = require('../models/employee');
const { uploadFile, deleteFile } = require('../config/azureStorage');
const { Op, fn, col } = require('sequelize');

// Create employee
exports.createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, department, salary, joinDate, status } = req.body;

    // Check unique email
    const existingEmployee = await Employee.findOne({ where: { email } });
    if (existingEmployee) {
      return res.status(400).json({ error: 'Employee with this email already exists.' });
    }

    let avatarUrl = null;
    let resumeUrl = null;

    // Handle file uploads
    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        avatarUrl = await uploadFile(
          req.files.avatar[0].buffer,
          req.files.avatar[0].originalname,
          req.files.avatar[0].mimetype
        );
      }
      if (req.files.resume && req.files.resume[0]) {
        resumeUrl = await uploadFile(
          req.files.resume[0].buffer,
          req.files.resume[0].originalname,
          req.files.resume[0].mimetype
        );
      }
    }

    const employee = await Employee.create({
      firstName,
      lastName,
      email,
      phone,
      role: role || 'Employee',
      department: department || 'General',
      salary: salary ? parseFloat(salary) : 0,
      joinDate: joinDate || new Date().toISOString().split('T')[0],
      status: status || 'Active',
      avatarUrl,
      resumeUrl
    });

    res.status(201).json(employee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: error.message || 'Server error while creating employee.' });
  }
};

// Get all employees with filtering, searching, sorting, and pagination
exports.getAllEmployees = async (req, res) => {
  try {
    const { search, department, role, status, sortBy = 'createdAt', sortOrder = 'DESC', page = 1, limit = 10 } = req.query;

    const whereClause = {};

    // Search filter (first name, last name, or email)
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Department filter
    if (department && department !== 'All') {
      whereClause.department = department;
    }

    // Role filter
    if (role && role !== 'All') {
      whereClause.role = role;
    }

    // Status filter
    if (status && status !== 'All') {
      whereClause.status = status;
    }

    // Pagination calculations
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const offset = (pageNum - 1) * limitNum;

    // Fetch matching data
    const { count, rows } = await Employee.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: limitNum,
      offset: offset
    });

    res.json({
      employees: rows,
      totalCount: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Server error while fetching employees.' });
  }
};

// Get single employee details
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee details:', error);
    res.status(500).json({ error: 'Server error fetching employee details.' });
  }
};

// Update employee details
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const { firstName, lastName, email, phone, role, department, salary, joinDate, status } = req.body;

    // Check email uniqueness if changing email
    if (email && email !== employee.email) {
      const existingEmail = await Employee.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already in use by another employee.' });
      }
      employee.email = email;
    }

    // Update basic text fields
    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (phone !== undefined) employee.phone = phone;
    if (role) employee.role = role;
    if (department) employee.department = department;
    if (salary !== undefined) employee.salary = salary ? parseFloat(salary) : 0;
    if (joinDate) employee.joinDate = joinDate;
    if (status) employee.status = status;

    // Handle file updates
    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        // Delete old avatar if it exists
        if (employee.avatarUrl) {
          await deleteFile(employee.avatarUrl);
        }
        // Upload new avatar
        employee.avatarUrl = await uploadFile(
          req.files.avatar[0].buffer,
          req.files.avatar[0].originalname,
          req.files.avatar[0].mimetype
        );
      }
      
      if (req.files.resume && req.files.resume[0]) {
        // Delete old resume if it exists
        if (employee.resumeUrl) {
          await deleteFile(employee.resumeUrl);
        }
        // Upload new resume
        employee.resumeUrl = await uploadFile(
          req.files.resume[0].buffer,
          req.files.resume[0].originalname,
          req.files.resume[0].mimetype
        );
      }
    }

    await employee.save();
    res.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: error.message || 'Server error while updating employee.' });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Delete files from storage
    if (employee.avatarUrl) {
      await deleteFile(employee.avatarUrl);
    }
    if (employee.resumeUrl) {
      await deleteFile(employee.resumeUrl);
    }

    await employee.destroy();
    res.json({ message: 'Employee deleted successfully.' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Server error while deleting employee.' });
  }
};

// Get Dashboard analytics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalEmployees = await Employee.count();
    
    // Status breakdown
    const activeCount = await Employee.count({ where: { status: 'Active' } });
    const inactiveCount = await Employee.count({ where: { status: 'Inactive' } });

    // Average salary
    const avgSalaryResult = await Employee.findAll({
      attributes: [[fn('avg', col('salary')), 'avgSalary']]
    });
    const avgSalary = parseFloat(avgSalaryResult[0]?.dataValues?.avgSalary || 0).toFixed(2);

    // Department breakdown
    const departmentBreakdown = await Employee.findAll({
      attributes: ['department', [fn('count', col('id')), 'count']],
      group: ['department']
    });

    // Recent hires (limit 5)
    const recentHires = await Employee.findAll({
      order: [['joinDate', 'DESC'], ['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      totalEmployees,
      activeCount,
      inactiveCount,
      avgSalary,
      departmentBreakdown,
      recentHires
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error while calculating analytics dashboard.' });
  }
};
