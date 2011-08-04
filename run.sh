export PORT=9980
nohup supervisor app.js > /dev/null 2> /dev/null < /dev/null &
