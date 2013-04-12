var Operator = require('./operator.js');

var o = module.exports = new Operator();

o.override('show all', function(resource, request, handler) {
  resource.all(handler);
});

o.override('create', function(resource, request, handler) {
  resource.create(request.body, handler);
});

o.override('show', function(resource, request, handler) {
  if (typeof request.id == 'string' && /\d+/.test(request.id))
    request.id = parseInt(request.id);

  resource.get({ _id: request.id }, handler);
});

o.override('update', function(resource, request, handler) {
  resource.update(request.body, handler);
});

o.override('delete', function(resource, request, handler) {
  resource.delete(request.id, handler);
});
