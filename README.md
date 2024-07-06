<p align="center">
  <img src="https://github.com/joyou-io/nsfwjs-server/assets/18582456/d14353ed-4e4b-4880-960b-0066775173ac" alt="NSFWJS Server Logo" width="400" />
  <h2 align="center">NSFW web server via <a href="https://github.com/infinitered/nsfwjs">NSFWJS</a></h2>
</p>

### Features 

- ℹ️ Return predictions for `Neutral`, `Drawing`, `Sexy`, `Hentai` and `Porn`
- 🎯 Pretty accurate (~93%)
- 🖼️ Supports jpg / png / gif / webp image formats

### Installation 
- npm i

### Start 
- node main.js  or node main.js 9000
  
  web server running at port 9016(default)

### Usage  

  POST request to Content-Type: multipart/form-data sending an image in the image field

- image binary
 
  curl -X POST localhost:9016/upload  -F 'image=@./draw1.jpg'
  
- image path
  
  curl -X POST localhost:9016/upload -F 'image=draw1.jpg'
  
- image url
  
  curl -X POST localhost:9016/upload -F 'https://xxx.com/draw1.jpg'

### Response
  only code : 0 and data.isSafe : true means a "good" image!

  {
	"code": 0,
	"msg": "bad image!",
	"data": {
		"isSafe": false,
		"imgType": "Porn",
		"predictions": [
			{
				"className": "Porn",
				"probability": 0.6056722402572632
			},
			{
				"className": "Sexy",
				"probability": 0.3434692621231079
			},
			{
				"className": "Hentai",
				"probability": 0.030655445531010628
			},
			{
				"className": "Neutral",
				"probability": 0.017868373543024063
			},
			{
				"className": "Drawing",
				"probability": 0.0023346678353846073
			}
		]
	}
  }
