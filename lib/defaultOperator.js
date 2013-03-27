var Operator = require('./operator.js');

var o = module.exports = new Operator();

o.isNotAcceptable = function isNotAcceptable(request) {
  var accept = request.request.headers.accept;
  console.log(accept);
  if (accept && accept.indexOf('application/json') === -1
      && accept.indexOf('*/*') === -1)
    return {
      status : 406,
      message : "Not Acceptable. The client does not accept the content type 'application/json'."
    };

  return false;
}

o.override('show all', function(resource, request, handler) {
  var err = isNotAcceptable(request);
  if (err)
    return handler(err);

  resource.all(handler);
});

o.override('create', function(resource, request, handler) {
  var err = isNotAcceptable(request);
  if (err)
    return handler(err);

  resource.create(request.body, handler);
});

o.override('show', function(resource, request, handler) {
  var err = isNotAcceptable(request);
  if (err)
    return handler(err);

  if (typeof request.id == 'string' && /\d+/.test(request.id))
    request.id = parseInt(request.id);

  resource.get({ _id: request.id }, handler);
});

o.override('update', function(resource, request, handler) {
  var err = isNotAcceptable(request);
  if (err)
    return handler(err);

  resource.update(request.body, handler);
});

o.override('delete', function(resource, request, handler) {
  var err = isNotAcceptable(request);
  if (err)
    return handler(err);

  resource.delete(request.id, handler);
});
