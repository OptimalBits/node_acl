module.exports = require("./lib/acl.js");
module.exports.redisBackend = require("./lib/redis-backend.js");
module.exports.memoryBackend = require("./lib/memory-backend.js");
module.exports.mongodbBackend = require("./lib/mongodb-backend.js");
module.exports.couchdbBackend = require("./lib/couchdb-backend.js");