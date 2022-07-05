const SpotifyWebApi = require('spotify-web-api-node')
const express = require('express')
const dotenv = require('dotenv')

const app = express()
dotenv.config()

const login = () =>{
    return new SpotifyWebApi({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri: "http://localhost:8083/login/success"
    })
}

app.get('/login', (req, res) => {
    const scopes = [
        'app-remote-control',
        'streaming',
        'user-modify-playback-state',
        'user-read-playback-state',
        'user-read-currently-playing'
    ]

    const spotify = login()

    const authorizeURL = spotify.createAuthorizeURL(scopes, "hello");

    res.redirect(authorizeURL)
})

app.get('/login/success', (req, res) =>{
    res.send("Login successful")
    const code = req.query.code

    const spotify = login()

    spotify.authorizationCodeGrant(code).then(
        async function (data) {
            spotify.setAccessToken(data.body['access_token']);
            spotify.setRefreshToken(data.body['refresh_token']);
            spotify.getMyDevices().then((data) => {
                data.body.devices.forEach(
                    (device) => {
                        console.log(device.is_active + " " + device.type + " " + device.name + ": " + device.id)
                    }
                )
            })
            await spotify.transferMyPlayback(['7769113f1c3db537e4e6827de2615c3799d70f17'], {play: true})
        },
        function(err) {
            console.log('Something went wrong!', err);
        })
})

app.listen(8083)
console.log("Server running")
