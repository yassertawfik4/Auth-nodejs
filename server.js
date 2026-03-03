import app from "./app.js";
import dotenv from "dotenv";
dotenv.config();

import connectDB from "./config/database.js";
await connectDB();

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
