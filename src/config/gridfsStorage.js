// src/config/gridfsStorage.js
import { GridFSBucket } from 'mongodb';
import mongoose from 'mongoose';

class GridFsStorage {
  constructor(opts) {
    // Wait until the mongoose connection is open before creating the bucket
    if (!mongoose.connection.db) {
      throw new Error('MongoDB connection is not ready. Please ensure the connection is established before using GridFsStorage.');
    }
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

// Export a factory that waits for the connection to be ready
const gridFsFactory = async (opts) => {
  if (!mongoose.connection.db) {
    // Wait for the connection to open if not ready
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
    });
  }
  return new GridFsStorage(opts);
};

export default gridFsFactory;
