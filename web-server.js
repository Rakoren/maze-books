const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname,'web');
const port = process.env.PORT || 3000;

const mime = {
  '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg'
};

http.createServer((req,res)=>{
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if(reqPath === '/' ) reqPath = '/index.html';
  // Serve a single source-of-truth themes.json from project root if requested
  let fp;
  if(reqPath === '/themes.json'){
    fp = path.join(__dirname, 'themes.json');
  } else {
    fp = path.join(root, reqPath);
  }
  // basic path traversal protection: allow either web root or project root themes.json only
  if(!(fp.startsWith(root) || fp === path.join(__dirname,'themes.json'))){ res.statusCode=403; return res.end('Forbidden'); }
  fs.readFile(fp, (err,data)=>{
    if(err){ res.statusCode=404; return res.end('Not found'); }
    const ext = path.extname(fp);
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.end(data);
  });
}).listen(port, ()=>console.log(`Web UI server running at http://localhost:${port}/`));
