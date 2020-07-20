var path = require('path'),
fs = require("fs");
exports.privateKey = fs.readFileSync(path.join(__dirname, '/home/ubuntu/krazykoder.key')).toString();
exports.certificate = fs.readFileSync(path.join(__dirname, '/home/ubuntu/1a6e78b351a30fba.crt')).toString();