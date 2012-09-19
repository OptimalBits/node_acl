
var testBackend = require('./acl_test').testBackend;

/* memory */
testBackend("memory", {}, function(results){
  var exitCode = results.honored === results.total ? 0 : -1;
  exitCode && process.exit(exitCode);
  
  /* redis */
  testBackend("redis", { host:'127.0.0.1', port:6379}, function(results){
    var exitCode = results.honored === results.total ? 0 : -1;
    exitCode && process.exit(exitCode);
    
    /* MongoDB */
    //testBackend("mongodb", "mongodb://127.0.0.1:27017/acltest");
    testBackend("mongodb", "mongodb://127.0.0.1:27017/acltest", function(results){
      var exitCode = results.honored === results.total ? 0 : -1;
      exitCode && process.exit(exitCode);
    })
  });
});
