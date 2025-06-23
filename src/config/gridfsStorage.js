// src/config/gridfsStorage.js
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

class GridFsStorage {
  constructor(opts) {
    // ← pick up your mongoose connection's native driver DB
    this.bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: opts.bucketName || 'uploads'
    });
  }

  // Called by multer _before_ uploading each file
  _handleFile(req, file, cb) {
    const filename = `${Date.now()}_${file.originalname}`;
    const uploadStream = this.bucket.openUploadStream(filename, {
      contentType: file.mimetype
    });

    // pipe the incoming file stream into GridFS
    file.stream
      .pipe(uploadStream)
      .on('error', err => cb(err))
      .on('finish', () => {
        // callback with file info — multer attaches this to req.file
        cb(null, {
          bucketName: this.bucket.s.options.bucketName,
          id:         uploadStream.id,
          filename,
          contentType: file.mimetype,
          size:       uploadStream.length
        });
      });
  }

  // Called by multer on file removal (e.g. error cleanup)
  _removeFile(req, file, cb) {
    this.bucket.delete(file.id, cb);
  }
}

module.exports = opts => new GridFsStorage(opts);
