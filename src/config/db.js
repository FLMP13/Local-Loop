import mongoose from 'mongoose';
import config from './config.js';

const connectDB = () => {
    return mongoose.connect(config.MONGO_URI);
};

export default connectDB;