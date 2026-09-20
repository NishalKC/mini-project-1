const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log("MongoDB Connection Error:", err);
  });

module.exports = mongoose.connection;