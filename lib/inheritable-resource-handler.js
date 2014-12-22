/**
	Simple Resource Builder.
	
  Implementation of the resource ID builder using part of URL
*/
"use strict";

var    _ = require('lodash'),
contract = require('./contract');

function regExpEscape(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

function InheritableResourceHandler(inheritanceStopper){
  this.inheritanceStopper = inheritanceStopper || '-';
}

/**
  merge( resourcePermissions, function(err, mergedResourcePermissions) )

  Merge all levels of the resource permissions.

  @param {Object} a map of permission where every resource name is linked to a list of 
                  permissions for that resource. If a permission name ends with '-', then this permission
                  won't be inherited. If a permission name starts with '-', then this permission will be
                  not allowed to inherit from its parents.
  @param {Function} Callback called wish the merged resource permissions.
*/
InheritableResourceHandler.prototype.merge = function(resourcePermissions, cb) {
  contract(arguments).params('object', 'function').end();

  var _this = this;
  var inheritanceStopperPrefixTester = new RegExp('^' + regExpEscape(this.inheritanceStopper));
  var inheritanceStopperSuffixTester = new RegExp(regExpEscape(this.inheritanceStopper) + '$');
  var mergedPermissions = [];
  _.forEach(resourcePermissions, function(resPermissions) {
  
   // remove non-inheritable permissions obtained from parents
    mergedPermissions = _.filter(mergedPermissions, function(p) { return !inheritanceStopperSuffixTester.test(p); });
    
    // add new resource permissions
    mergedPermissions = _.uniq(_.union(mergedPermissions, resPermissions));
    
   // remove non-inheritable permissions obtained from both parents and current level
    var deniedPermissions = [];
    mergedPermissions = _.filter(mergedPermissions, function(p) {
      if (inheritanceStopperPrefixTester.test(p)) {
        deniedPermissions.push(p.substr(_this.inheritanceStopper.length));
        return false;
      } else {
        return true;
      }
    });
    if (deniedPermissions.length > 0) {
      mergedPermissions = _.filter(mergedPermissions, function(p) {
        return deniedPermissions.indexOf(p) === -1;
      });
    }
  });

  // remove inheritanceStopper suffix from permissions
  mergedPermissions = _.map(mergedPermissions, function(p) {
    if (inheritanceStopperSuffixTester.test(p)) {
      return p.substr(0, p.length - _this.inheritanceStopper.length);
    } else {
      return p;
    }
  });
  
  cb(undefined, mergedPermissions);
};

/**
  isAllowed( permissions, resourcePermissions, function(err, allowed) )

  Checks if the resource permissions meet the given permissions (note: it must fulfill all the permissions).

  @param {String|Array} asked permissions.
  @param {Object} a map of permission where every resource name is linked to a list of 
                  permissions for that resource. If a permission name ends with '-', then this permission
                  won't be inherited. If a permission name starts with '-', then this permission will be
                  not allowed to inherit from its parents.
  @param {Function} Callback called wish the result.
*/
InheritableResourceHandler.prototype.isAllowed = function(permissions, resourcePermissions, cb) {
  contract(arguments).params('string|array', 'object', 'function').end();

  var _this = this;
  this.merge(resourcePermissions, function(err, mergedPermissions) {
    if (err) {
      cb(err);
    } else {
     if (mergedPermissions.indexOf('*') !== -1){
        cb(undefined, true);
      } else {
        var notAllowedPermissions =  makeArray(permissions).filter(function(p){ 
                    return mergedPermissions.indexOf(p) === -1; 
                  });
        cb(undefined, notAllowedPermissions.length === 0);
      }
    }
  });
};

//-----------------------------------------------------------------------------
//
// Helpers
//
//-----------------------------------------------------------------------------

function makeArray(arr){
  return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = InheritableResourceHandler;

