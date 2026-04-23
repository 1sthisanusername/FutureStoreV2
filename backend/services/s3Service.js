// services/s3Service.js — AWS S3 cover image upload
const multer   = require('multer');
const path     = require('path');

let upload;

try {
  const multerS3 = require('multer-s3');
  const { S3Client } = require('@aws-sdk/client-s3');

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    upload = multer({
      storage: multerS3({
        s3,
        bucket: process.env.AWS_S3_BUCKET,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const ext  = path.extname(file.originalname);
          const name = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        cb(null, allowed.test(file.mimetype));
      },
    });
    console.log('☁️   S3 image upload enabled');
  }
} catch (_) {}

// Fallback: memory storage (no local disk saving)
if (!upload) {
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      cb(null, /jpeg|jpg|png|webp/.test(file.mimetype));
    },
  });
  console.log('⚠️   Cloud storage not configured. Images will NOT be saved to disk.');
}

// Returns the public URL after upload
const getFileUrl = (req) => {
  if (!req.file) return null;
  // S3 upload sets location; local sets path
  return req.file.location || `${process.env.FRONTEND_URL || 'http://localhost:5000'}/covers/${req.file.filename}`;
};

module.exports = { upload, getFileUrl };
