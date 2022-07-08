const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios').default
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
            console.log(response)
        })
        .catch(error => {
            console.log(error)
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
    await axios.get(deviceUrl + "/web-api/v1/me/player/recently-played", { params: { limit: 50} } )
        .then(response => {
            response.data.items.forEach(item =>{
                console.log(item.track.name+ " " + item.track.uri)
                console.log(item.track.artists[0].name + " " + item.track.artists[0].uri)
            })
            console.log(response.data.items.length)
        })
        .catch(error => {
            console.log(error)
        })
    res.send()
})

app.post('/next', async (req, res) => {
    await post(res,"/player/next")
})

app.post('/prev', async (req, res) => {
    await post(res, "/player/prev")
})

app.post('/playRandom', async (req, res) => {
    const dreiFragezeichenId = "3meJIgRw7YleJrmbpbJK6S"
    let totalAlbumCount;
    await axios.get(deviceUrl + "/web-api/v1/artists/" + dreiFragezeichenId + "/albums")
        .then(albums => {
            totalAlbumCount = albums.data.total
        })
        .catch(error => {
            console.log(error)
        })

    let albumId
    if(totalAlbumCount > settings.lastAlbumCount) {
        albumId = await getAlbumId(dreiFragezeichenId, totalAlbumCount - 1)
        settings.lastAlbumCount = totalAlbumCount
    } else {
        const albumNumber = Math.floor(Math.random() * (totalAlbumCount - 1))
        albumId = await getAlbumId(dreiFragezeichenId, albumNumber)
    }

    await axios.post(deviceUrl + "/player/load", "uri=spotify:album:" + albumId + "&play=true&shuffle=false")
    res.send()
}, function (err) {
    console.log('Something went wrong!', err);
})

const getAlbumId = async (artistID, albumNumber) => {
    const offset = albumNumber - albumNumber % 50;
    const limit = 50;
    const adjustedAlbumNumber = albumNumber - offset;

    let id
    await axios.get(deviceUrl + "/web-api/v1/artists/" + artistID + "/albums", {
        params: { limit, offset}
    })
        .then(albums => {
            id = albums.data.items[adjustedAlbumNumber].id
        })
        .catch(error => {
            console.log(error)
        })

    return id
}

loadSettings()

app.listen(8083)
console.log("Server running")
