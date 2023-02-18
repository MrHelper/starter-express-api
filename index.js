require('dotenv').config();
const express = require('express')
const app = express()
const AWS = require("aws-sdk");
const s3 = new AWS.S3()
const fileUpload = require('express-fileupload');
const { Deta } = require("deta");
const detaKey = process.env.DETA_KEY
const deta = Deta(detaKey);
const drive = deta.Drive("photos");
const cors = require('cors');

app.use(cors());
app.use(fileUpload());

app.get('/', async(req, res) => {
    res.send("Welcome")
});

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

app.post('/upload', async(req, res) => {
    if (!req.files) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file;
    const fileName = `${Date.now()}.${file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2)}`;
    const fileType = file.mimetype;
    const fileContent = file.data;

    const s3Params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        Body: fileContent,
        ContentType: fileType,
    };
    s3.upload(s3Params).promise().then(data => {
            const publicUrl = s3.getSignedUrl('getObject', {
                Bucket: process.env.BUCKET,
                Key: fileName,
                Expires: null // URL expiration time in seconds
            });
            res.json({ "File": fileName, "FileURL": publicUrl })
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Error getting object from S3'); 
        });

});

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`index.js listening at http://localhost:${port}`)
})