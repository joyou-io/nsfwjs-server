/**
     _                            _          _         
    | | ___  _   _  ___  _   _   | |    __ _| |__  ___ 
 _  | |/ _ \| | | |/ _ \| | | |  | |   / _` | '_ \/ __|
| |_| | (_) | |_| | (_) | |_| |  | |__| (_| | |_) \__ \
 \___/ \___/ \__, |\___/ \__,_|  |_____\__,_|_.__/|___/
             |___/                                     
                      
*/
const express = require("express");
const fs = require('fs');
const path = require('path')
const multer = require("multer");
const jpeg = require('jpeg-js');
const png = require("fast-png");
const nsfw = require('nsfwjs');
const tf = require('@tensorflow/tfjs');
const gifFrames = require('gif-frames');
const axios = require("axios");
const webp = require('webp-wasm');

const app = express();
tf.enableProdMode();


// safe image classes
const safeContent = ['Drawing', 'Neutral', 'Sexy'];
// local http server port
let PORT = 9016;
// safe accuracy
const ACCURACY = 0.55;
// max upload file size(M)
const MAX_UPLOAD_FILE_SIZE = 10;//M
// gif frames to identify, more big more slower
const GIF_FRAMES = '0,4,9,14,19';//0-4,9

let argv = process.argv[2]
if (argv) {
  PORT = argv;
}

const upload = multer({
  //dest: 'uploads/' ,
  limits: {
    fileSize: Math.ceil(MAX_UPLOAD_FILE_SIZE * 1024 * 1024)
  }
}
).single('image');

const imgTypeoObj = {
  Drawing: 'Drawing',
  Neutral: 'Neutral',
  Sexy: 'Sexy',
  Porn: 'Porn',
  Hentai: 'Hentai',
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//convert tensor3d
const convert = async (bufferOrPath,imgExt) => {
  let image;
  let data;
  if (typeof bufferOrPath === 'string') {
    if(imgExt === '.jpg' || imgExt === '.gif'){
      let jpegData = fs.readFileSync(bufferOrPath);
      image = jpeg.decode(jpegData, { useTArray: true });
      data=image.data;
    }
    else if(imgExt === '.png'){
      let pngData = fs.readFileSync(bufferOrPath);
      image = png.decode(pngData, { useTArray: true });
      data=image.data;
    }
    else if(imgExt === '.webp'){
      let webpData = fs.readFileSync(bufferOrPath);
      image = await webp.decode(webpData);
      data = new Uint8Array(image.data);
    }
  }
  else {
    if(imgExt === '.jpg' || imgExt === '.gif'){
      image = await jpeg.decode(bufferOrPath, { useTArray: true });
      data=image.data;
    }
    else if(imgExt === '.png'){
      image = await png.decode(bufferOrPath, { useTArray: true });
      data=image.data;
    }
    else if(imgExt === '.webp'){
      image = await webp.decode(bufferOrPath);
      data = new Uint8Array(image.data);
    }
  }

  const numChannels = 3;
  const numPixels = image.width * image.height;
  const values = new Int32Array(numPixels * numChannels);

  for (let i = 0; i < numPixels; i++) {
    for (let c = 0; c < numChannels; ++c) {
      values[i * numChannels + c] = data[i * 4 + c];
    }
  }

  return tf.tensor3d(values, [image.height, image.width, numChannels], 'int32');
};

// load the model
let model;
const load_model = async () => {
  model = await nsfw.load();
};

const isSafeContent = predictions => {
  let safeProbability = 0;
  let imgTypeValArr = [];
  for (let index = 0; index < predictions.length; index++) {
    const item = predictions[index];
    const className = item.className;
    const probability = item.probability;
    if (safeContent.includes(className)) {
      safeProbability += probability;
    };
  }
  imgTypeValArr = predictions.sort((a, b) => b.probability - a.probability);
  // console.log('imgTypeValArr:', imgTypeValArr);
  let myimgType = '';
  if (imgTypeValArr.length && imgTypeValArr[0]) {
    myimgType = imgTypeoObj[imgTypeValArr[0].className];
  }
  return {
    isSafe: safeProbability > ACCURACY,
    imgType: myimgType,
    predictions: predictions
  };
};

app.post('/upload', (req, res) => {
  console.time('Time consumed');
  upload(req, res, async function (err) {
    // Max upload file size
    if (err){
      return res.status(400).send({
        code: -1,
        msg: `Upload image size must below ${MAX_UPLOAD_FILE_SIZE}M!`,
        data: {}
      })
    }

    if (!req.file && !req.body.image) {
      return res.status(400).send({
        code: -2,
        msg: 'Missing image path/url or image multipart/form-data!',
        data: {}
      })
    }


    try {
      
      let data = { isSafe: false, imgType: '', predictions: [] };

      // image type
      let jpgpngwebpReg = /\S+\.(jpeg|jpg|png|webp)$/g;
      let gifReg = /\S+\.(gif)$/g;
      let webpReg = /\S+\.(webp)$/g;
      let originImgName = req.body.image || req.file.originalname;
      const ext = path.extname(originImgName).toLowerCase();
      let bufferOrPath = req.body.image?req.body.image:req.file.buffer;
      if(req.body.image){
        if (req.body.image.slice(0, 7) === 'http://' || req.body.image.slice(0, 8) === 'https://') {
          let pic = await axios.get(req.body.image, {
            responseType: "arraybuffer",
          });
          bufferOrPath = pic.data;
        }
      }

      if (jpgpngwebpReg.test(originImgName)) {
        let img = await convert(bufferOrPath, ext);
        let predictions = await model.classify(img);
        data = isSafeContent(predictions);
        img.dispose();
        console.timeEnd('Time consumed');
        return res.send({
          code: 0,
          msg: data.isSafe ? 'good image!' : 'bad image!',
          data
        })
      }
     
      else if (gifReg.test(originImgName)) {
        //load gif, frames: '0-4,9,19'
        gifFrames({ url: bufferOrPath, frames: GIF_FRAMES, outputType: 'jpg', cumulative: true })
          .then(async function (frameData) {
            //frameData.forEach(async function (frame) {
            for (const frame of frameData) {
              let obj=frame.getImage()._obj;
              let img = await convert(obj,ext);
              await delay(150);
              let predictions = await model.classify(img);
              data = isSafeContent(predictions);
              img.dispose();
             
              if (!data.isSafe)
                break;
            };
            console.timeEnd('Time consumed');
            return res.send({
              code: 0,
              msg: data.isSafe ? 'good image!' : 'bad image!',
              data
            })

          }).catch((err) => {
            return res.status(400).send({
              code: -3,
              msg: 'Can load gif,try again later!',
              data: {}
            })

          });

      }
      else {
        return res.status(400).send({
          code: -4,
          msg: 'Only support png/jpeg/jpg/gif/webp!',
          data: {}
        })
        
      }

      //console.log('end');

      
    } catch (error) {
      return res.status(400).send({
        code: -5,
        msg: 'Unknown error,try again later!',
        data: {}
      })
    }
  })
});



// local http server
load_model().then(() => app.listen(PORT, () => {
  console.log("Server started successfully! port：" + PORT);
}));
