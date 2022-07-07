const SpotifyWebApi = require('spotify-web-api-node')
const express = require('express')
const dotenv = require('dotenv')
const {response} = require("express");
const axios = require('axios').default

const app = express()
dotenv.config()

const login = (path) => {
    return new SpotifyWebApi({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri: "http://localhost:8083" + path
    })
}

const authorize = async (req) => {
    const spotify = login(req.path)
    const code = req.query.code

    await spotify.authorizationCodeGrant(code).then(async (data) => {
        spotify.setAccessToken(data.body['access_token']);
        spotify.setRefreshToken(data.body['refresh_token']);
    })

    return spotify
}

app.get('/:path', (req, res) => {
    const scopes = ['app-remote-control', 'streaming', 'user-modify-playback-state', 'user-read-playback-state', 'user-read-currently-playing']

    const spotify = login("/authorized/" + req.params.path)

    const authorizeURL = spotify.createAuthorizeURL(scopes, "hello");

    res.redirect(authorizeURL)
})

const post = async (res, path) => {
    const response = await axios.post('http://192.168.2.31:24879' + path)
        .then(response => {
            console.log(response)
        })
        .catch(error => {
            console.log(error)
        })
    res.send(response)
}


app.post('/play-pause', async (req, res) =>{
    await post(res,"/player/play-pause")
})

app.post('/next', async (req, res) => {
    await post(res,"/player/next")
})

app.post('/prev', async (req, res) => {
    await post(res, "/player/prev")
})

app.get('/authorized/playRandom', async (req, res) => {
    res.send("Login successful")

    const spotify = await authorize(req)

    const dreiFragezeichenId = "3meJIgRw7YleJrmbpbJK6S"
    let totalAlbumCount;
    await spotify.getArtistAlbums(dreiFragezeichenId).then((data) => {
        totalAlbumCount = data.body.total
    })
    const albumNumber = Math.floor(Math.random() * (totalAlbumCount - 1) + 1)

    const offset = albumNumber - albumNumber % 50;
    const limit = 50;
    const adjustedAlbumNumber = albumNumber - offset;
    let albumId;
    await spotify.getArtistAlbums(dreiFragezeichenId, {limit, offset}).then(data => {
        albumId = data.body.items[adjustedAlbumNumber].id
    })
    console.log(await spotify.getAlbum(albumId))
    await spotify.getAlbumTracks(albumId, {limit: 20}).then(async (data) => {
        for (const item of data.body.items) {
            console.log(item.uri)
            await spotify.addToQueue(item.uri)
        }
    })
    await spotify.transferMyPlayback(['7769113f1c3db537e4e6827de2615c3799d70f17'], {play: true})
    await spotify.setShuffle(false)
    await spotify.setVolume(0)
    while (true) {
        await spotify.skipToNext()
        const currentTrack = await spotify.getMyCurrentPlayingTrack()
        if (currentTrack.body.item.track_number === 1) break
    }
    await spotify.setVolume(20)
}, function (err) {
    console.log('Something went wrong!', err);
})

app.listen(8083)
console.log("Server running")
