var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var _ = require('lodash');

var testData = {
  key1: ["1", "2", "3"],
  key2: ["3", "2", "4"],
  key3: ["3", "4", "5"]
};
var buckets = ['bucket1', 'bucket2'];

exports.unions = function() {
  describe('unions', function() {
    before(function(done) {
      var backend = this.backend;
      if (!backend.unions) {
        this.skip();
      }

      backend.clean(function() {
        var transaction = backend.begin();
        Object.keys(testData).forEach(function(key) {
          buckets.forEach(function(bucket) {
            backend.add(transaction, bucket, key, testData[key]);
          });
        });
        backend.end(transaction, done);
      });
    });

    after(function(done) {
      this.backend.clean(done);
    });

    it('should respond with an appropriate map', function(done) {
      var expected = {
        'bucket1': ["1", "2", "3", "4", "5"],
        'bucket2': ["1", "2", "3", "4", "5"]
      };
      this.backend.unions(buckets, Object.keys(testData), function(err, result) {
        expect(err).to.be.null;
        expect(result).to.be.eql(expected);
        done();
      });
    });

    it('should get only the specified keys', function(done) {
      var expected = {
        'bucket1': ['1', '2', '3'],
        'bucket2': ['1', '2', '3']
      }
      this.backend.unions(buckets, ['key1'], function(err, result) {
        expect(err).to.be.null;
        expect(result).to.be.eql(expected);
        done();
      });
    });

    it('should only get the specified buckets', function(done) {
      var expected = {
        'bucket1': ['1', '2', '3']
      };
      this.backend.unions(['bucket1'], ['key1'], function(err, result) {
        expect(err).to.be.null;
        expect(result).to.be.eql(expected);
        done();
      });
    });
  });
};
