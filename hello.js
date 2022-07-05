const SpotifyWebApi = require('spotify-web-api-node')
const express = require('express')
const dotenv = require('dotenv')

const app = express()
dotenv.config()

app.get('/login', (req, res) => {
    const scopes = [
        'app-remote-control',
        'streaming',
        'user-modify-playback-state',
        'user-read-playback-state',
        'user-read-currently-playing'
    ]

    const spotify = new SpotifyWebApi({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri: "http://localhost:8083/login/success"
    })

    const authorizeURL = spotify.createAuthorizeURL(scopes, "hello");
    res.redirect(authorizeURL)
})

app.get('/login/success', (req, res) =>{
    res.send("Login successful")
    const code = req.query.code
})

app.listen(8083)
console.log("Server running")
