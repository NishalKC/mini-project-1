const mongoose = require("mongoose")

mongoose.connect(`mongodb://127.0.0.1:27017/mini-project`)

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