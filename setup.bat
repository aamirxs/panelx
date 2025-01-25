@echo off
echo Installing Ubuntu Web Panel...

REM Create necessary directories
mkdir uploads
mkdir public
mkdir views

REM Install dependencies
npm install

echo Setup completed!
echo To start the panel, run: npm start
