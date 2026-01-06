

import mongoose from 'mongoose';

import logger from '../utils/logger.js';




mongoose.set('strictQuery', true);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("DB connected");
    } catch (error) {
        logger.error('DB connection error', error.message);
        process.exit(1); 
    }
};

export default connectDB;