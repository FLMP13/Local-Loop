import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = () => {
    return mongoose.connect(process.env.MONGO_URI);
};

export default connectDB;