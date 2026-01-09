const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Create uploads directory structure
const uploadsDir = path.join(__dirname, '../uploads');
const formsDir = path.join(uploadsDir, 'forms');
const filledFormsDir = path.join(uploadsDir, 'filled-forms');

// Ensure directories exist
[uploadsDir, formsDir, filledFormsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created upload directory: ${dir}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, Word, Excel, images, and text files are allowed'));
  }
};

// Local storage configuration
const createLocalStorage = (folder) => {
  const storageDir = folder === 'forms' ? formsDir : filledFormsDir;
  
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, storageDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `${uniqueSuffix}-${file.originalname}`;
      cb(null, filename);
    }
  });
};

// Create storage instances
const formStorage = createLocalStorage('forms');
const filledFormStorage = createLocalStorage('filled-forms');

// Create multer instances
const uploadForm = multer({
  storage: formStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

const uploadFilledForm = multer({
  storage: filledFormStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

logger.info('Local file storage configured successfully');

// Generate download URL for local files
const getSignedUrl = async (filePath) => {
  if (!filePath) return null;
  
  try {
    // For local storage, return the file path relative to uploads directory
    // The actual file serving will be handled by Express static middleware
    const fullPath = path.join(__dirname, '../uploads', filePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      logger.error(`File not found: ${fullPath}`);
      return null;
    }
    
    // Return relative path that can be used with /api/files endpoint
    return `/api/files/${filePath}`;
  } catch (error) {
    logger.error('Error generating file URL:', error);
    return null;
  }
};

// Delete file from local storage
const deleteFile = async (filePath) => {
  if (!filePath) return;
  
  try {
    const fullPath = path.join(__dirname, '../uploads', filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`Deleted file: ${filePath}`);
    } else {
      logger.warn(`File not found for deletion: ${filePath}`);
    }
  } catch (error) {
    logger.error('Error deleting file:', error);
  }
};

// Export multer middleware with error handling
const uploadFormMiddleware = (req, res, next) => {
  uploadForm.single('formFile')(req, res, (err) => {
    if (err) {
      logger.error('Multer upload error in uploadFormMiddleware:', err);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: err.message || 'File upload failed',
          error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    }
    if (!res.headersSent) {
      next();
    }
  });
};

const uploadFilledFormMiddleware = (req, res, next) => {
  uploadFilledForm.single('filledFormFile')(req, res, (err) => {
    if (err) {
      logger.error('Multer upload error in uploadFilledFormMiddleware:', err);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: err.message || 'File upload failed',
          error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    }
    if (!res.headersSent) {
      next();
    }
  });
};

module.exports = {
  uploadForm: uploadFormMiddleware,
  uploadFilledForm: uploadFilledFormMiddleware,
  getSignedUrl,
  deleteFile
};
