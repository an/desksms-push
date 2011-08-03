
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var url = require('url');
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

var ajax = function(urlStr, callback) {
 var u = url.parse(urlStr);
 http.get({ host: u.host, port: u.port, path: u.pathname + (u.search ? u.search : ''), headers: {'Accept': '*/*', 'User-Agent': 'curl'} },
   function(res) {
     var data = '';
     res.on('data', function(chunk) {
       data += chunk;
     }).on('end', function() {
       try {
         callback(null, eval("(" + data + ")"));
       }
       catch (err) {
         console.log('exception during ajax');
         console.log(err);
         callback(err);
       }
     });
   }).on('error', function(error){
     console.log('error during ajax');
     console.log(error);
     callback(error);
   });
}

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

var clients = {};

app.post('/event', function(req, res) {
  try {
    var client = req.body.registration_id;
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

app.get('/wait/:registration_id', function(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  console.log('here');
  var client = req.params.registration_id;
  if (client == null) {
    res.send({error: 'no client'});
    return;
  }
  
  console.log(client);

  var u = 'https://desksms.appspot.com/api/v1/push/' + encodeURIComponent(client);
  console.log(u);
  ajax(u, function(err, data) {
    if (err) {
      res.send({error: err});
      return;
    }
    
    console.log(data);

    var clientEntry = clients[client];
    if (!clientEntry) {
      clients[client] = clientEntry = {};
      clientEntry.listeners = {};
    }
  
    var done = false;
    var looper = function() {
      setTimeout(function() {
        console.log('looper');
        if (done)
          return;
        res.write('\n');
        looper();
      }, 30 * 1000);
    };

    // 30 second keepalive
    looper();

    // 30 minute timeout
    setTimeout(function() {
      res.send({error: 'no data'});
    }, 30 * 60 * 1000);

    var eventHandler = function(data) {
      done = true;
      console.log(data);
      console.log('sent');
      var callback = req.query.callback;
      if (callback) {
        res.send(callback + "(" + JSON.stringify(data) + ")");
      }
      else {
        res.send(data);
      }
    }

    req.on('close', function() {
      console.log('close');
      done = true;
    });

    clientEntry.listeners[eventHandler] = eventHandler;
    
    console.log('ajax exit');
  });
  
  console.log('exit');
});


var listenPort = process.env.PORT == null ? 3000 : parseInt(process.env.PORT);
app.listen(listenPort);
console.log('Express app started on port ' + listenPort);
