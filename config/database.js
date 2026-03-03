import mongoose from "mongoose";

export default async () => {
  try {
    const MONGO_URL = process.env.MONGO_URL;
    await mongoose.connect(MONGO_URL, {
      dbName: "UserAuth",
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log("database connection failed");
    throw error;
  }
};
