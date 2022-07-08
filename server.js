const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios').default
const fs = require('fs')

const app = express()
dotenv.config()

const deviceUrl = 'http://192.168.2.31:24879'
let settings

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
        .then(() => {
            console.log("post to " + path)
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
    if(track && track.artist[0].name === "Die drei ???") {
        await post(res, "/player/play-pause")
    } else {
        let recentlyPlayed = await getMostRecent()
        if(!recentlyPlayed.trackNumber){
            recentlyPlayed = { lastAlbum: settings.currentAlbum, trackNumber: settings.currentTrackNumber}
        }
        await axios.post(deviceUrl + "/player/load", "uri=spotify:album:" + recentlyPlayed.lastAlbum + "&play=false&shuffle=false")
        for (let i = recentlyPlayed.trackNumber; i > 0; i--){
            await post(res,"/player/next")
        }
    }
    res.send()
})

const getMostRecent = async () => {
    let trackNumber;
    let lastAlbum;
    await axios.get(deviceUrl + "/web-api/v1/me/player/recently-played", {params: {limit: 50}})
        .then(response => {
            for(let i = 0; i<response.data.items.length; i++){
                if(response.data.items[i].track.artists[0].name === "Die drei ???"){
                    trackNumber = response.data.items[i].track.track_number
                    lastAlbum = response.data.items[i].track.album.id
                    break
                }
            }
        })
        .catch(error => {
            console.log(error)
        })
    return { trackNumber, lastAlbum }
}

app.post('/next', async (req, res) => {
    await post(res,"/player/next")
})

app.post('/prev', async (req, res) => {
    await post(res, "/player/prev")
})

app.post('/first', async (req, res) =>{
    await axios.post(deviceUrl + "/player/current").then(async current => {
        const track = current.data.current
        const trackId = track.substring(14)
        const metadata = await axios.get(deviceUrl + "/web-api/v1/tracks/" + trackId)
        await axios.post(deviceUrl + "/player/load/", "uri=" + metadata.data.album.uri + "&play=true&shuffle=false")
    })
    res.send()
})

app.post('/playRandom', async (req, res) => {
    await playRandom()
    saveSettings()
    res.send()
}, function (err) {
    console.log('Something went wrong!', err);
})

const playRandom = async () =>{
    // todo make sudo-random by storing the played album counts
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
    settings.currentAlbum = albumId
}

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
