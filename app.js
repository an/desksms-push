
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
    
    console.log('event for ' + client);

    var data = JSON.parse(req.body.data);

    for (var entry in clientEntry.listeners) {
      console.log('firing event handler');
      console.log(entry);
      entry = clientEntry.listeners[entry];
      entry(data);
    }

    res.send({success: true});
    
    // clear out the handlers
    delete clients[client];
  }
  catch (e) {
    console.log('error in /event');
    console.log(e);
    res.send({error: e});
  }
});

app.get('/wait/:registration_id', function(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  var client = req.params.registration_id;
  if (!client || client == 'undefined' || client == 'null') {
    console.log('no client');
    res.send({error: 'no client'});
    return;
  }
  
  console.log('client: ' + client);

  var u = 'https://desksms.appspot.com/api/v1/push/' + encodeURIComponent(client);
  ajax(u, function(err, data) {
    if (err) {
      console.log('error during ajax');
      res.send({error: err});
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
        try {
          if (done)
            return;
          res.write('\n');
          looper();
        }
        catch (e) {
          console.log('error in looper');
          console.log(e);
        }
      }, 30 * 1000);
    };

    // 30 second keepalive
    looper();

    // 30 minute timeout
    setTimeout(function() {
      try {
        done = true;
        res.write(JSON.stringify({error: 'no data'}));
        res.end();
      }
      catch (e) {
        console.log('error in timeout');
        console.log(e);
      }
    }, 30 * 60 * 1000);

    var eventHandler = function(data) {
      try {
        done = true;
        var callback = req.query.callback;
        if (callback) {
          res.write(callback + "(" + JSON.stringify(data) + ")");
        }
        else {
          res.write(JSON.stringify(data));
        }
        res.end();
      }
      catch (e) {
        console.log('error in event handler');
        console.log(e);
      }
    }

    var now = Date.now();
    req.on('close', function() {
      try {
        console.log('close: ' + client);
        delete clientEntry.listeners[now];
        done = true;
        res.end();
      }
      catch (e) {
        console.log('error in close');
        console.log(e);
      }
    });

    clientEntry.listeners[now] = eventHandler;
  });
});


var listenPort = process.env.PORT == null ? 3000 : parseInt(process.env.PORT);
app.listen(listenPort);
console.log('Express app started on port ' + listenPort);
