require("dotenv").config();
const express = require("express");
const app = express();
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const fileUpload = require("express-fileupload");
const { Deta } = require("deta");
const detaKey = process.env.DETA_KEY;
const deta = Deta(detaKey);
const drive = deta.Drive("photos");
const db = deta.Base("ukfDB");
const dbAuth = deta.Base("ukfDBUser");

const CyclicDb = require("@cyclic.sh/dynamodb");
const ukfdb = CyclicDb("real-puce-cape-buffalo-cuffCyclicDB");

const dbpj = ukfdb.collection("project");
const dbuser = ukfdb.collection("user");

const bodyParser = require("body-parser");
var jsonParser = bodyParser.json();

const cors = require("cors");

app.use(cors());
app.use(fileUpload());

async function getSignedUrl(key) {
  return new Promise((resolve, reject) => {
    let params = {
      Bucket: process.env.BUCKET,
      Key: key,
      Expires: 60 * 60 * 24 * 3,
    };
    s3.getSignedUrl("getObject", params, (err, url) => {
      if (err) reject(err);
      resolve(url);
    });
  });
}

app.get("/", async (req, res) => {
  res.send("Welcome");
});

app.post("/login", jsonParser, async (req, res) => {
  let email = req.body.email;
  let pass = req.body.pass;
  let item = await dbuser.get("admin");
  if (item.props.pass == pass && item.props.email == email) res.send(true);
  else res.send(false);
  // check is email and pass include on any item of collection
});

app.post("/project", jsonParser, async (req, res) => {
  let key =
    req.body.key == null ? req.body.name + "_" + Date.now() : req.body.key;
  dbpj.set(key, req.body);
  res.send(true);
});

app.get("/projects", async (req, res) => {
  let item = await dbpj.filter();
  console.log(item);
  res.send(item);
});

app.delete("/project/:key", async (req, res) => {
  const key = req.params.key;
  const item = await dbpj.delete(key);
  res.send(item);
});

app.get("/user/create", async (req, res) => {
  await dbuser.set("admin", {
    email: "hung.np2188@icloud.com",
    pass: "vungoimora",
  });
  res.send(item);
});

app.get("/project", async (req, res) => {
  let dataPJ = await db.fetch({
    Type: "pj",
  });
  let allItems = dataPJ.items;
  while (dataPJ.last) {
    dataPJ = await db.fetch({}, { last: dataPJ.last });
    allItems = allItems.concat(dataPJ.items);
  }

  let project = allItems.sort((a, b) => b.No - a.No);
  for (let i = 0; i < project.length; i++) {
    let element = project[i];
    let imgs = element.Images.split(",");
    let imgurl = [];

    let imgUrlsPromises = imgs.map((imgname) => {
      let params = {
        Bucket: process.env.BUCKET,
        Key: imgname,
        Expires: 60 * 60 * 24 * 3, // URL expiration time in seconds
      };
      return new Promise((resolve, reject) => {
        s3.getSignedUrl("getObject", params, (err, url) => {
          if (err) reject(err);
          resolve(url);
        });
      });
    });

    try {
      let imgUrls = await Promise.all(imgUrlsPromises);
      imgurl = imgUrls.filter((url) => url !== null);
    } catch (err) {
      console.error("Error getting signed URLs for images:", err);
    }

    project[i].ImagesURL = imgurl.join(",");
  }

  res.send(project);
});

// app.get("/project", async (req, res) => {
//   let dataPJ = await db.fetch({
//     Type: "pj",
//   });
//   let allItems = dataPJ.items;
//   while (dataPJ.last) {
//     dataPJ = await db.fetch({}, { last: dataPJ.last });
//     allItems = allItems.concat(dataPJ.items);
//   }

//   let project = allItems.sort((a, b) => b.No - a.No);
//   for (let i = 0; i < project.length; i++) {
//     let element = project[i];
//     let imgs = element.Images.split(",");
//     let imgurl = [];
//     for (let j = 0; j < imgs.length; j++) {
//       let imgname = imgs[j];
//       // let publicUrl = s3.getSignedUrl("getObject", {
//       //   Bucket: process.env.BUCKET,
//       //   Key: imgname,
//       //   Expires: 60 * 60 * 24 * 3, // URL expiration time in seconds
//       // });
//       // imgurl.push(publicUrl);
//       let params = {
//         Bucket: process.env.BUCKET,
//         Key: imgname,
//         Expires: 60 * 60 * 24 * 3, // URL expiration time in seconds
//       };

//       try {
//         let publicUrl = await new Promise((resolve, reject) => {
//           s3.getSignedUrl("getObject", params, (err, url) => {
//             if (err) reject(err);
//             resolve(url);
//           });
//         });
//         imgurl.push(publicUrl);
//       } catch (err) {
//         console.error(`Error getting signed URL for image ${imgname}:`, err);
//       }
//     }
//     project[i].ImagesURL = imgurl.join(",");
//   }

//   res.send(project);
// });

app.get("/image/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const fileData = await drive.get(name);
    if (fileData) {
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.set("Content-Type", "image/jpeg");
      res.status(200).end(buffer, "binary");
    } else {
      res.status(500).send("Internal server error");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.post("/upload", async (req, res) => {
  if (!req.files) {
    return res.status(400).send("No file uploaded.");
  }

  const file = req.files.file;
  const fileName = `${Date.now()}.${file.name.slice(
    ((file.name.lastIndexOf(".") - 1) >>> 0) + 2
  )}`;
  const fileType = file.mimetype;
  const fileContent = file.data;

  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: fileName,
    Body: fileContent,
    ContentType: fileType,
  };
  s3.upload(s3Params)
    .promise()
    .then((data) => {
      const publicUrl = s3.getSignedUrl("getObject", {
        Bucket: process.env.BUCKET,
        Key: fileName,
        Expires: null, // URL expiration time in seconds
      });
      res.json({ File: fileName, FileURL: publicUrl });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error getting object from S3");
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`index.js listening at http://localhost:${port}`);
});
