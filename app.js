
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

var clients = {};

app.post('/event/:client', function(req, res) {
  try {
    var client = req.params.client;
    var clientEntry = clients[client];
    if (!clientEntry) {
      res.send({error: 'no client'});
      return;
    }

    var data = JSON.parse(req.body.data);

    for (var entry in clientEntry.listeners) {
      entry = clientEntry.listeners[entry];
      entry(data);
    }

    res.send({success: true});
    
    // clear out the handlers
    delete clients[client];
  }
  catch (e) {
    res.send({error: e});
  }
});

app.get('/wait/:client', function(req, res) {
  var client = req.params.client;
  if (client == null) {
    res.send({error: 'no client'});
    return;
  }
  var clientEntry = clients[client];
  if (!clientEntry) {
    clients[client] = clientEntry = {};
    clientEntry.listeners = {};
  }
  
  var done = false;
  var looper = function() {
    setTimeout(function() {
      if (done)
        return;
      res.write('\n');
      looper();
    }, 30 * 1000);
  };
  
  // 30 second keepalive
  looper();

  var eventHandler = function(data) {
    done = true;
    console.log(data);
    console.log('sent');
    var callback = res.query.callback;
    if (callback) {
      res.send(callback + "(" + JSON.stringify(data) + ")");
    }
    else {
      res.send(data);
    }
  }
  
  req.on('close', function() {
    done = true;
  });

  clientEntry.listeners[eventHandler] = eventHandler;
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
