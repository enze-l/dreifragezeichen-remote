const SpotifyWebApi = require('spotify-web-api-node')
const dotenv = require('dotenv')
dotenv.config()

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
    redirectUri: "http://localhost:631"
})

const code = process.env.AUTH_CODE

const authorizeURL = spotify.createAuthorizeURL(scopes, "hello");

console.log(authorizeURL)
