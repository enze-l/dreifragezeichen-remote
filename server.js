const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios').default
const spotify = require('spotify-finder')
const fs = require('fs')

const app = express()
dotenv.config()

const deviceUrl = 'http://192.168.2.31:24879'
let settings = {
    "currentAlbum": "3NYWEuwAPt4PIJ4OeNxmzO",
    "lastAlbumCount": 261
}

function loadSettings() {
    let rawData = fs.readFileSync('./savestate.json')
    settings = JSON.parse(rawData)
}

function saveSettings() {
    let data = JSON.stringify(settings, null, 2)
    fs.writeFileSync('./savestate.json', data)
}

const post = async (res, path) => {
    const response = await axios.post(deviceUrl + path)
        .then(response => {
            //console.log(response)
        })
        .catch(error => {
            //console.log(error)
        })
    res.send(response)
}

app.post('/play-pause', async (req, res) =>{
    let track
    await axios.post(deviceUrl + "/player/current").then(current =>{
        track = current.data.track
    })
    if(track) {
        await post(res, "/player/play-pause")
    }
    //todo play last played track
})

app.post('/next', async (req, res) => {
    await post(res,"/player/next")
})

app.post('/prev', async (req, res) => {
    await post(res, "/player/prev")
})

app.post('/playRandom', async (req, res) => {
    const client = new spotify({
        consumer:{
            key: '260a4318f5d14b73a5a0bc96a999ef4d',
            secret: 'f320bb25f7d548c69a337c249d72fe8b'
        }
    })

    const dreiFragezeichenId = "3meJIgRw7YleJrmbpbJK6S"
    let totalAlbumCount;
    await client.getArtist(dreiFragezeichenId, {
        albums: true,
        album_type: 'album',
    }).then(albums =>{
        totalAlbumCount = albums.total
    })

    let albumId
    if(totalAlbumCount > settings.lastAlbumCount) {
        albumId = await getAlbumId(client, dreiFragezeichenId, totalAlbumCount)
    } else {
        const albumNumber = Math.floor(Math.random() * (totalAlbumCount - 1) + 1)
        albumId = await getAlbumId(client, dreiFragezeichenId, albumNumber)
    }
    console.log(albumId)

    await axios.post(deviceUrl + "/player/load", "uri=spotify:album:" + albumId + "&play=true&shuffle=false")
    res.send()
}, function (err) {
    console.log('Something went wrong!', err);
})

const getAlbumId = async (client, artistID, albumNumber) =>{
    const offset = albumNumber - albumNumber % 50;
    const limit = 50;
    const adjustedAlbumNumber = albumNumber - offset;
    let id
    await client.getArtist(artistID,{
        albums: true,
        album_type: 'album',
        limit,
        offset
    }).then(albums =>{
        id = albums.items[adjustedAlbumNumber].id
    })
    return id
}

loadSettings()

app.listen(8083)
console.log("Server running")
