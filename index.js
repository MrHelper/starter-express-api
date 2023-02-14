require('dotenv').config();
const express = require('express')
const app = express()

const { Deta } = require("deta");
const detaKey = process.env.DETA_KEY
const deta = Deta(detaKey);
const drive = deta.Drive("photos");

app.all('/', (req, res) => {
    console.log("Just got a request!")
    res.send('Yo!')
})

app.get('/image/:name', async(req, res) => {
    try {
        const name = req.params.name;
        const fileData = await drive.get(name);
        if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.set("Content-Type", "image/jpeg");
            res.status(200).end(buffer, 'binary');
        } else {
            res.status(500).send('Internal server error');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.listen(process.env.PORT || 3000)