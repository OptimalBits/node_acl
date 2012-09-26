var testBackend = require('./acl_test').testBackend,
  async = require('async');

var tests = [

  /* Memory */
  function(cb) {
    console.log("Testing memory backend");
    testBackend("memory", {}, cb);
  },
  
  /* Redis */
  function(cb) {
    console.log("Testing Redis backend");
    var options = {
      host: '127.0.0.1',
      port: 6379,
      password: null
    };
    testBackend("redis", options, cb);
  },
  
  /* MongoDB */
  function(cb) {
    console.log("Testing MongoDB backend");
    var url = "mongodb://127.0.0.1:27017/acltest";
    testBackend("mongodb", url, cb);
  }

];

// run tests
async.forEachSeries(tests, function(test, cb) {
  test(function(results) {
    var exitCode = results.honored === results.total ? 0 : -1;
    exitCode && process.exit(exitCode);
    cb();
  });
}, function(){
  process.exit(0);
});