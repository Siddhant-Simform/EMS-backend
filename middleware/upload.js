const multer = require('multer');

// Configure multer memory storage
const storage = multer.memoryStorage();

// File size limits: 2MB for avatar, 5MB for resume/documents
const limits = {
  fileSize: 5 * 1024 * 1024 // We'll set a general 5MB limit, then validate individually if needed
};

// File filter based on type
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'avatar') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for the profile picture!'), false);
    }
  } else if (file.fieldname === 'resume') {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, or TXT files are allowed for the resume!'), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage: storage,
  limits: limits,
  fileFilter: fileFilter
}).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

module.exports = upload;
