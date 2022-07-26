const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios').default
const fs = require('fs')
const Gpio = require('onoff').Gpio

const app = express()
dotenv.config()

const deviceUrl = process.env.DEVICE_URL
const alarmPlaylistId = process.env.ALARM_PLAYLIST_ID
const dreiFragezeichenId = "3meJIgRw7YleJrmbpbJK6S"

let settings
let timeout
let alarm

const tv = new Gpio(23, 'out')
const speaker = new Gpio(24, 'out')
let tvValue = 0
let speakerValue = 0

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
    if(res) {
        res.send(response)
    }
}

app.post('/tv/on-off', async (req, res) => {
    tvValue = 1 - tvValue
    await tv.write(tvValue)
    res.send()
})

app.post('/speaker/on-off', async (req, res) => {
    speakerValue = 1 - speakerValue
    await speaker.write(speakerValue)
    res.send()
})

app.post('/play-pause', async (req, res) => {
    let track
    await axios.post(deviceUrl + "/player/current").then(current => {
        track = current.data.track
    })
    if (track && track.artist[0].name === "Die drei ???") {
        await post(res, "/player/play-pause")
    } else {
        let recentlyPlayed = await getMostRecent()
        if (!recentlyPlayed.trackNumber) {
            recentlyPlayed = {lastAlbum: settings.currentAlbum, trackNumber: settings.currentTrackNumber}
        }
        await axios.post(deviceUrl + "/player/load", "uri=spotify:album:" + recentlyPlayed.lastAlbum + "&play=false&shuffle=false")
        for (let i = recentlyPlayed.trackNumber; i > 0; i--) {
            await post(res, "/player/next")
        }
    }
    setSleepTimer(res)
    res.send()
})

app.post('/setAlarm', async (req, res) =>{
    await setAlarm()
    res.send()
})

const setSleepTimer = (res) => {
    const pause = () => post(res, "/player/pause")
    timeout = setTimeout(pause, 30 * 60 * 1000)
    clearTimeout(timeout)
}

const setAlarm = (res) => {
    clearTimeout(alarm)
    const play = async () => {
        await axios.post(deviceUrl + "/player/load", "uri=spotify:playlist:" + alarmPlaylistId + "&shuffle=true&play=false")
        await post(undefined, "/player/next")
    }
    alarm = setTimeout(play, 8 * 60 * 60 * 1000)
}

const getMostRecent = async () => {
    let trackNumber;
    let lastAlbum;
    await axios.get(deviceUrl + "/web-api/v1/me/player/recently-played", {params: {limit: 50}})
        .then(response => {
            for (let i = 0; i < response.data.items.length; i++) {
                if (response.data.items[i].track.artists[0].name === "Die drei ???") {
                    trackNumber = response.data.items[i].track.track_number
                    lastAlbum = response.data.items[i].track.album.id
                    break
                }
            }
        })
        .catch(error => {
            console.log(error)
        })
    return {trackNumber, lastAlbum}
}

app.post('/next', async (req, res) => {
    await post(res, "/player/next")
})

app.post('/prev', async (req, res) => {
    await post(res, "/player/prev")
})

app.post('/first', async (req, res) => {
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
    setSleepTimer(res)
    res.send()
}, function (err) {
    console.log('Something went wrong!', err);
})

const playRandom = async () => {
    let totalAlbumCount;
    await axios.get(deviceUrl + "/web-api/v1/artists/" + dreiFragezeichenId + "/albums")
        .then(albums => {
            totalAlbumCount = albums.data.total
        })
        .catch(error => {
            console.log(error)
        })

    let albumNumber
    if (totalAlbumCount > settings.lastAlbumCount) {
        albumNumber = totalAlbumCount
        settings.lastAlbumCount = totalAlbumCount
    } else {
        albumNumber = await getSudoRandomAlbumNumber(totalAlbumCount)
    }
    const albumId = await getAlbumId(albumNumber)

    await axios.post(deviceUrl + "/player/load", "uri=spotify:album:" + albumId + "&play=true&shuffle=false")

    settings.currentAlbum = albumId
    increasePlayTime(albumId, albumNumber)
}

const increasePlayTime = (albumId, albumNumber) => {
    let albumFound = false
    settings.playedAlbums.forEach(album => {
        if (album.albumId === albumId) {
            album.playedTimes++
            albumFound = true
        }
    })

    if(!albumFound){
        settings.playedAlbums.push({albumNumber: albumNumber, albumId: albumId, playedTimes: 1})
    }
    saveSettings()
}

const getSudoRandomAlbumNumber = async (totalAlbumCount) => {
    // find out lowest playedTimesNumber
    let lowestPlayedNumber = Infinity
    if (settings.playedAlbums.length < totalAlbumCount) {
        lowestPlayedNumber = 0
    } else {
        settings.playedAlbums.forEach(album => {
            if (album.playedTimes < lowestPlayedNumber) {
                lowestPlayedNumber = album.playedTimes
            }
        })
    }
    // get an array with all numbers that are played the least
    const allAlbumNumbers = Array.from(Array(totalAlbumCount).keys())
    const overplayedAlbumNumbers = []
    settings.playedAlbums.forEach(album => {
        if (album.playedTimes > lowestPlayedNumber) {
            overplayedAlbumNumbers.push(album.albumNumber)
        }
    })
    const albumNumberPool = allAlbumNumbers.filter(number => !overplayedAlbumNumbers.includes(number))
    const sudoRandomAlbumIndex = Math.floor(Math.random() * albumNumberPool.length)
    return albumNumberPool[sudoRandomAlbumIndex];
}

const getAlbumId = async (albumNumber) => {
    const offset = albumNumber - albumNumber % 50;
    const limit = 50;
    const adjustedAlbumNumber = albumNumber - offset;

    let id
    await axios.get(deviceUrl + "/web-api/v1/artists/" + dreiFragezeichenId + "/albums", {
        params: {limit, offset}
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
