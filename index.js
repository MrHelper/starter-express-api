require('dotenv').config();
const express = require('express')
const app = express()
const AWS = require("aws-sdk");
const s3 = new AWS.S3()
const bodyParser = require('body-parser');
const { Deta } = require("deta");
const detaKey = process.env.DETA_KEY
const deta = Deta(detaKey);
const drive = deta.Drive("photos");

app.use(bodyParser.json())

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

app.get('*', async(req, res) => {
    let filename = req.path.slice(1)

    try {
        let s3File = await s3.getObject({
            Bucket: process.env.BUCKET,
            Key: filename,
        }).promise()

        res.set('Content-type', s3File.ContentType)
        res.send(s3File.Body.toString()).end()
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log(`No such key ${filename}`)
            res.sendStatus(404).end()
        } else {
            console.log(error)
            res.sendStatus(500).end()
        }
    }
})

app.post('*', async(req, res) => {
    let filename = req.path.slice(1)

    console.log(typeof req.body)

    await s3.putObject({
        Body: JSON.stringify(req.body),
        Bucket: process.env.BUCKET,
        Key: filename,
    }).promise()

    res.set('Content-type', 'text/plain')
    res.send('ok').end()
})

app.delete('*', async(req, res) => {
    let filename = req.path.slice(1)

    await s3.deleteObject({
        Bucket: process.env.BUCKET,
        Key: filename,
    }).promise()

    res.set('Content-type', 'text/plain')
    res.send('ok').end()
})


const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`index.js listening at http://localhost:${port}`)
})