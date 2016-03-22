var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var _ = require('lodash');

var testData = {
  key1: ["1", "2", "3"],
  key2: ["4", "5", "6"],
  key3: ["7", "8", "9"]
};
var bucket = 'test-bucket';

exports.getAll = function() {
  describe('getAll', function() {
    before(function(done) {
      var backend = this.backend;
      if (!backend.getAll) {
        this.skip();
      }

      backend.clean(function() {
        var transaction = backend.begin();
        Object.keys(testData).forEach(function(key) {
          backend.add(transaction, bucket, key, testData[key]);
        });
        backend.end(transaction, done);
      });
    });

    after(function(done) {
      this.backend.clean(done);
    });

    it('should respond with an appropriate map', function(done) {
      this.backend.getAll(bucket, Object.keys(testData), function(err, result) {
        expect(err).to.be.null;
        expect(result).to.be.eql(testData);
        done();
      });
    });

    it('should get only the specified keys', function(done) {
      this.backend.getAll(bucket, ['key1'], function(err, result) {
        expect(err).to.be.null;
        expect(result).to.be.eql(_.pick(testData, 'key1'));
        done();
      });
    });

    it('should be order-independent', function(done) {
      this.backend.getAll(bucket, Object.keys(testData).reverse(), function(err, result) {
        expect(err).to.be.null;
        expect(result).to.be.eql(testData);
        done();
      });
    });
  });
};
