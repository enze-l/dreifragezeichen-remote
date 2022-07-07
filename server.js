const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios').default
const spotify = require('spotify-finder')

const app = express()
dotenv.config()

const deviceUrl = 'http://192.168.2.31:24879'

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
    await post(res,"/player/play-pause")
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

    const albumNumber = Math.floor(Math.random() * (totalAlbumCount - 1) + 1)

    const offset = albumNumber - albumNumber % 50;
    const limit = 50;
    const adjustedAlbumNumber = albumNumber - offset;
    let albumId;
    client.getArtist(dreiFragezeichenId,{
        albums: true,
        album_type: 'album',
        limit,
        offset
    }).then(albums =>{
        albumId = albums.items[adjustedAlbumNumber].id
    })

    await axios.post(deviceUrl + "/player/load", "uri=spotify:album:3NYWEuwAPt4PIJ4OeNxmzO&play=true&shuffle=false")
    res.send()
}, function (err) {
    console.log('Something went wrong!', err);
})

app.listen(8083)
console.log("Server running")
