const mongoose = require("mongoose")

const userSchema = mongoose.Schema({
    username: String,
    name: String,
    age : Number,
    email: String,
    password: String,
    profilepic: {
        type: String,
        default: "default.jpg"
    },
    post: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref : "post"
        }
    ],
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ],
    messages: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ]
})

module.exports = mongoose.model("user", userSchema)