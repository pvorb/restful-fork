var director = require('director');
var resourceful = require('resourceful');
var url = require('url');
var util = require('util');

exports.RestpostenRouter = function(resource, options) {
  options = options || {};
  
  director.http.Router.call(this, options);
  
  this.resource = resource;
  this.strict = options.strict || false;
  
  exports.extendRouter(this, resource, options);
};

util.inherits(ResourcefulRouter, director.http.Router);

exports.name = 'restful';

exports.init = function(done) {
  done();
};

exports.attach = function(options) {
  var app = this;
  if (!app.resources)
    return;
  
  // extend the app's router with routes for all resources
  Object.keys(app.resources).forEach(resource) {
    var res = app.resources[resource];
    var opt = options || res.restful || {};
    
    if (!res.restful)
      return;
    
    exports.extendRouter(app.router, res, opt);
  });
};

exports.extendRouter = function(router, resources, options) {
  options = options || {};
  
  if (typeof options == 'boolean' && options) {
    options = {};
  }
  
  options.prefix = options.prefix || '';
  options.strict = options.strict || false;
  options.exposeMethods = options.exposeMethods || true;
  options.explore =
    (typeof options.explore == 'undefined') ? true : options.explore;
  
  // make api explorable
  if (options.explore) {
    router.get('/', function () {
      var rsp = '';
      rsp += de.table(self);
      this.res.end(rsp);
    });
  }
  
  router.path(prefix, function () {
    var self = this;
    this.get('/', function (_id) {
      var res = this.res,
          req = this.req;
      if (!options.strict) {
        preprocessRequest(req, resources, 'index');
      }
      respond(req, res, 200, '', resources);
    });
    
    // TODO _extend
  });
};
