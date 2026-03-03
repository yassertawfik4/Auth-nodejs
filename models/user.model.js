import mongoose from "mongoose";

const user_Schema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      require: true,
      unique: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("User", user_Schema, "user");
