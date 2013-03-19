var director = require('director');
var resourceful = require('resourceful');
var url = require('url');
var util = require('util');
var pluralize = require('i').pluralize;
var de = require('director-explorer');

exports.RestpostenRouter = function(resource, options) {
  options = options || {};
  
  director.http.Router.call(this, options);
  
  this.resource = resource;
  this.strict = options.strict || false;
  
  exports.extendRouter(this, resource, options);
};

util.inherits(exports.RestpostenRouter, director.http.Router);

exports.name = 'restful';

exports.init = function(done) {
  done();
};

exports.attach = function(options) {
  var app = this;
  if (!app.resources) return;
  
  // extend the app's router with routes for all resources
  Object.keys(app.resources).forEach(function(resource) {
    var res = app.resources[resource];
    var opt = options || res.restful || {};
    
    if (!res.restful) return;
    
    exports.extendRouter(app.router, res, opt);
  });
};

exports.extendRouter = function(router, resources, options) {
  var self = this;

  options = options || {};

  if (typeof options == 'boolean' && options) {
    options = {};
  }

  options.prefix = options.prefix || '';
  options.strict = options.strict || false;
  options.exposeMethods = options.exposeMethods || true;
  options.explore =
    (typeof options.explore == 'undefined') ? true : options.explore;

  var respond = options.respond || respondWithResult;

  // make api explorable
  if (options.explore) {
    router.get('/', function () {
      var rsp = '';
      rsp += de.table(self);
      this.res.end(rsp);
    });
  }

  router.path(options.prefix, function () {
    var self = this;
    this.get('/', function () {
      var res = this.res,
          req = this.req;
      if (!options.strict) {
        preprocessRequest(req, resources, 'index');
      }
      respond(req, res, 200, '', resources);
    });
    
    if (!Array.isArray(resources)){
      resources = [resources];
    }

    var routeInfo = [];

    resources.forEach(function (resource) {
      var entity = resource.lowerResource,
          param = options.param || ':id';

      // If we are not in strict mode, then extend the router with, some
      // potentially helpful non-restful routes
      if (!options.strict)
        nonStrictRoutes(router, resource, options, respond);

      // Scope all routes under /:resource
      router.path(entity, function () {
        // Bind resource.all ( show all ) to GET /:resource
        this.get(function () {
          var res = this.res,
              req = this.req;

          var showHandler = function (err, results) {
            if (!options.strict) {
              preprocessRequest(req, resource, 'list', results);
            }
            return err
              ? respond(req, res, 500, err)
              : respond(req, res, 200, entity, results);
          };

          resource.all(getFields('all', req), getOptions('all', req),
              showHandler);
        });

        // Bind POST /:resource to resource.create()
        this.post(function () {
          var res    = this.res,
              req    = this.req;

          if (!options.strict) {
            preprocessRequest(req, resource);
          }
          
          var cloned = utile.clone(options);

          cloned.parentID = exports.buildResourceId(routeInfo, arguments);

          // Remark: We need to reserve the id "new" in order to make
          // resource-routing work properly.
          // I don't agree with this, but I'm not aware of a better solution
          // solution.
          //
          // Based on research, both Rails and Express follow this same
          // convention, so we might as well try to conform to that unless there
          // is a better solution.
          var createHandler = function (err, result) {
            var status = 201;
            if (err) {
              status = 500;
              if (typeof err == "object") { // && key.valid === false
                status = 422;
              }
            }
            req.restful = {
              error: err,
              action: 'show',
              data: result,
              resource: resource
            };
            return err
              ? respond(req, res, status, err)
              : respond(req, res, status, resource.lowerResource, result);
          }
          
          resource.create(req.body, getOptions('create', req), createHandler);
        });

        //
        // Bind /:resource/:param path
        //
        this.path('/' + param, function () {
          var paramScopedRouter = this;

          //
          // Check to see if resource has any children
          //
          if (resource._children && resource._children.length > 0) {

            var childRouteInfo = routeInfo.concat(resource.lowerResource);

            //
            // For every child the resource has,
            // recursively call the extendRouter method,
            // prefixing the current resource as the base path
            //
            resource._children.forEach(function(child){
              var childResource = resourceful.resources[child],
                  clonedOptions = utile.clone(options);
              //
              // Remark: Create a new instance of options since we don't want,
              // to modify the reference scope inside this extendRouter call
              //
              clonedOptions.parent = resource;

              _extend(paramScopedRouter, childResource, clonedOptions, respond, childRouteInfo);
            });
          }

          //
          // If we are going to expose Resource methods to the router interface
          //
          if (options.exposeMethods) {
            //
            // Find every function on the resource,
            // which has the "remote" property set to "true"
            //
            for (var m in resource) {
              if(typeof resource[m] === "function" && resource[m].remote === true) {
                var self = this;

                //
                // For every function we intent to expose remotely,
                // bind a GET and POST route to the method
                //
                (function(m){
                  self.path('/' + m.toLowerCase(), function(){

                    var handler = function () {
                      var req = this.req,
                          res = this.res,
                          _id = exports.buildResourceId(routeInfo, arguments);

                      preprocessRequest(req, resource, 'remote');
                      resource[m](_id, req.body, function(err, result){
                        req.restful.message = result;
                        req.restful.data.id = _id;
                         return err
                           ? respond(req, res, 500, err)
                           : respond(req, res, 200, 'result', result);
                       });
                    }

                    this.get(handler);
                    this.post(handler);
                  });
                })(m)
              }
            }
          }

          //
          // Bind GET /:resource/:id to resource.get
          //
          this.get(function () {
            var res    = this.res,
                req    = this.req,
                cloned = utile.clone(options);

              if (!options.strict)
                preprocessRequest(req, resource, 'show');
              
              var showHandler = function (err, results) {
                if (!options.strict) {
                  preprocessRequest(req, resource, 'show');
                }
                return err
                  ? respond(req, res, 500, err)
                  : respond(req, res, 200, entity, results);
              };
              
              console.log(options);
              
              resource.get(getQuery('show', req), getFields('show', req),
                  getOptions('show', req), showHandler);
          });

          //
          // Bind POST /:resource/:id to resource.create(_id)
          //
          this.post(function () {
            var res    = this.res,
                req    = this.req,
                args   = Array.prototype.slice.call(arguments);
                cloned = utile.clone(options);

            // The id provided by the url overwrites any provided in the body.
            req.body.id = args.pop();

            // Work around that ugly bug
            if (typeof req.body.id == 'function')
              req.body.id = args.pop();

            if (!cloned.strict)
              preprocessRequest(req, resource);

            if (cloned.parent)
              cloned.parentID = exports.buildResourceId(routeInfo, args);

            controller.create(req, res, resource, cloned, respond);
          });
          
          //
          // Bind DELETE /:resource/:id to resource.destroy
          //
          this.delete(function () {
            var req = this.req,
                res = this.res;

            var _id = exports.buildResourceId(routeInfo, arguments);
            resource.destroy(_id, function (err, result) {
              return err
                ? respond(req, res, 500, err)
                : respond(req, res, 204);
            });
          });

          //
          // Bind PUT /:resource/:id to resource.update
          //
          this.put(function () {
            var req = this.req,
                res = this.res;

            if (!options.strict)
              preprocessRequest(req, resource);

            var _id = exports.buildResourceId(routeInfo, arguments);
            resource.update(_id, req.body, function (err, result) {
              var status = 204;
              if (err) {
                status = 500;
                if (typeof err === "object") { // && key.valid === false
                  status = 422;
                }
              }
              return err
                ? respond(req, res, status, err)
                : respond(req, res, status);
            });
          });
        });
      });
    });
  });
};

function nonStrictRoutes(router, resource, options, respond) {
  var entity = resource.lowerResource,
      param = options.param || ':id';
  //
  // Bind POST /new to resource.create
  //
  router.post('/' + entity + '/new', function (_id) {
    var res = this.res,
        req = this.req;

    if(typeof _id !== 'undefined') {
      _id = _id.toString();
    }

    var action = "show";
    preprocessRequest(req, resource, action);
    resource.create(req.restful.data, function (err, result) {
      var status = 201;
      if (err) {
        status = 500;
        action = "create";
        if (typeof err === "object") { // && key.valid === false
          status = 422;
        }
      }
      preprocessRequest(req, resource, action, result, err);
      return err
        ? respond(req, res, status, err)
        : respond(req, res, status, entity, result);
    });
  });


  router.get('/' + entity + '/find', function () {
    var res = this.res,
        req = this.req;
    preprocessRequest(req, resource, 'find');
    resource.find(req.restful.data, function(err, result){
      respond(req, res, 200, entity, result);
    });
  });

  router.post('/' + entity + '/find', function () {
    var res = this.res,
        req = this.req;
    preprocessRequest(req, resource, 'find');
    resource.find(req.restful.data, function(err, result){
      respond(req, res, 200, entity, result);
    });
  });

  router.get('/' + entity + '/new', function (_id) {
    var res = this.res,
        req = this.req;
    preprocessRequest(req, resource, 'create');
    respond(req, res, 200, '', {});
  });

  //
  // Bind /:resource/:param path
  //
  router.path('/' + entity + '/' + param, function () {

    this.get('/update', function (_id) {
      var res = this.res,
          req = this.req;
      preprocessRequest(req, resource, 'update');
      resource.get(_id, function(err, result){
        preprocessRequest(req, resource, 'update', result, err);
        return err
          ? respond(req, res, 500, err)
          : respond(req, res, 200, entity, result);
      })
    });

    this.get('/destroy', function (_id) {
      var res = this.res,
          req = this.req;
      preprocessRequest(req, resource, 'destroy');
      resource.get(_id, function(err, result){
        preprocessRequest(req, resource, 'destroy', result, err);
        if(err) {
          req.restful.data = _id;
        }
        return err
          ? respond(req, res, 500, err)
          : respond(req, res, 200, entity, result);
      })
    });

    //
    // Bind POST /:resource/:id/destroy to resource.destroy
    // Remark: Not all browsers support DELETE verb, so we have to fake it
    //
    this.post('/destroy', function (_id) {
      var req = this.req,
          res = this.res;
      if (!options.strict) {
        preprocessRequest(req, resource, 'destroy');
      }
      resource.destroy(_id, function (err, result) {
        req.restful.data = _id;
        return err
          ? respond(req, res, 500, err)
          : respond(req, res, 204);
      });
    });

    //
    // Bind POST /:resource/:id/update to resource.update
    // Remark: Not all browsers support PUT verb, so we have to fake it
    //
    this.post('/update', function (_id) {
      var req = this.req,
          res = this.res;

      if (!options.strict) {
        preprocessRequest(req, resource, 'update');
      }

      resource.update(_id, this.req.body, function (err, result) {
        var status = 204;

        if (err) {
          status = 500;
          if (typeof err === "object") { // && key.valid === false
            status = 422;
          }
        }

        return err
          ? respond(req, res, status, err)
          : respond(req, res, status, entity, result);
      });
    });


  });
}

function respondWithResult(req, res, status, key, value) {
  var result;
  res.writeHead(status, { 'Content-Type': 'application/json' });

  if (arguments.length === 5) {
    result = {};
    result[key] = value;
  }
  else {
    result = key;
  }

  res.end(result ? JSON.stringify(result) : '');
};

function preprocessRequest(req, resource, action, data, error) {

  data = data || {};
  error = error || null;
  req.body = req.body || {};

  //
  // Remark: `restful` generates a REST interface for a Resource.
  // Since Resources inheritently has more functionality then HTTP can provide
  // out of the box,
  // we are required to perform some type cohersions for non-strict mode.
  //
  // For instance: If we know a property type to be Number and we are using a,
  // HTML4 input to submit it's value...it will always come in as a "numbery"
  // String.
  //
  // This will cause the Number validation in Resourceful to fail since 50 !==
  // "50"

  for (var p in req.body) {

    //
    // Number: Attempt to coerce any incoming properties know to be Numbers to a
    // Number
    //
    if (resource.schema.properties[p] && resource.schema.properties[p].type === "number") {
      req.body[p] = Number(req.body[p]);
      if (req.body[p].toString() === "NaN") {
        req.body[p] = "";
      }
    }

    //
    // Array: Attempt to coerce any incoming properties know to be Arrays to an
    // Array
    //
    if (resource.schema.properties[p] && resource.schema.properties[p].type === "array") {
      //
      // TODO: Better array creation than eval
      //
      try {
        req.body[p] = eval(req.body[p]);
      } catch (err) {
      }
      if (!Array.isArray(req.body[p])) {
        req.body[p] = [];
      }
    }

    //
    // Boolean: Attempt to coerce any incoming properties know to be boolean to
    // an boolean
    //
    if (resource.schema.properties[p] && resource.schema.properties[p].type === "boolean") {
      if(typeof req.body[p] !== 'undefined') {
        data[p] = true;
      } else {
        data[p] = false;
      }
    }
  }

  var query = url.parse(req.url),
      params = qs.parse(query.query);

  //
  // Merge query and form data
  //
  for(var p in req.body) {
    if(typeof data[p] === 'undefined') {
      data[p] = req.body[p];
    }
  }

  for(var p in params) {
    if(typeof data[p] === 'undefined') {
      data[p] = params[p];
    }
  }

  //
  // Remark: Append a new object to the req for additional processing down the
  // middleware chain
  //
  req.restful = {
    action: action,
    resource: resource,
    data: data,
    error: error
  };

  //
  // TODO: If there is no in-coming ID, check to see if we have any attempted
  // secondary keys
  //
      /*
       * if (_id.length === 0) { ('check for alts'); if(req.body.name) { _id =
       * req.body.name; } }
       */

  //
  // Remark: Not returning any values since "req" is referenced in parent scope.
  //
}

function prettyPrint(resources) {
  var str = '';
  resources.forEach(function(resource){
    str += '\n\n';
    str += '## ' + resource._resource + ' - schema \n\n';
    str += JSON.stringify(resource.schema.properties, true, 2) + '\n\n';
  });
  return str;
}
