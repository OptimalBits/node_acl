module.exports = require('./lib/acl.js');
module.exports.__defineGetter__('redisBackend', function(){
  return require('./lib/redis-backend.js');
});
module.exports.__defineGetter__('memoryBackend', function(){
  return require('./lib/memory-backend.js');
});
module.exports.__defineGetter__('mongodbBackend', function(){
  return require('./lib/mongodb-backend.js');
});