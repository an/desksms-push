ulimit -n 1000000
export PORT=9980
nohup supervisor app.js > /dev/null 2> /dev/null < /dev/null &
