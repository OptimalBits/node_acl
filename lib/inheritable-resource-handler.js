/**
	Simple Resource Builder.
	
  Implementation of the resource ID builder using part of URL
*/
"use strict";

var    _ = require('lodash'),
contract = require('./contract');

function InheritableResourceHandler(inheritanceStopper){  
  this.inheritanceStopper = inheritanceStopper || '-';
}

/**
  isAllowed( permissions, resourcePermissions, function(err, allowed) )

  Checks if the resource permissions meet the given permissions (note: it must fulfill all the permissions).

  @param {String|Array} asked permissions.
  @param {Object} a map of permission where every resource name is linked to a list of 
                  permissions for that resource. If a permission name ends with '-', then this permission
                  won't be inherited.
  @param {Function} Callback called wish the result.
*/
InheritableResourceHandler.prototype.isAllowed = function(permissions, resourcePermissions, cb) {
  contract(arguments).params('string|array', 'object', 'function').end();

  var _this = this;
  var inheritanceStopperTester = new RegExp(this.inheritanceStopper);
  var mergedPermissions = [];
  _.forEach(resourcePermissions, function(resPermissions) {
   // remove non-inheritable permissions obtained from previous level
    mergedPermissions = _.filter(mergedPermissions, function(p) { return !inheritanceStopperTester.test(p); });
    // add new resource permissions
    mergedPermissions = _.uniq(_.compact(_.union(mergedPermissions, resPermissions)));
  });

  // remove inheritanceStopper from permissions
  mergedPermissions = _.map(mergedPermissions, function(p) {
    if (inheritanceStopperTester.test(p)) {
      return p.substr(0, p.length - _this.inheritanceStopper.length);
    } else {
      return p;
    }
  });

  if (mergedPermissions.indexOf('*') !== -1){
    cb(undefined, true);
    return;
  }

  cb(undefined, makeArray(permissions).filter(function(p){ return mergedPermissions.indexOf(p) === -1; }).length === 0);
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

