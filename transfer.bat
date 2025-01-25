@echo off
echo Creating deployment package...

:: Create a temporary directory for deployment files
mkdir deploy_temp

:: Copy all necessary files to the temp directory
xcopy /E /I /Y "." "deploy_temp\"

:: Remove unnecessary files and directories from the package
rd /S /Q "deploy_temp\node_modules" 2>nul
rd /S /Q "deploy_temp\deploy_temp" 2>nul
del /Q "deploy_temp\*.zip" 2>nul

:: Create the ZIP file
powershell Compress-Archive -Path deploy_temp\* -DestinationPath ubuntu-web-panel.zip -Force

:: Clean up
rd /S /Q deploy_temp

echo Package created: ubuntu-web-panel.zip
echo.
echo To transfer to Ubuntu server, run:
echo scp ubuntu-web-panel.zip username@your-server-ip:/home/username/
echo.
echo After transferring, connect to your server and run:
echo unzip ubuntu-web-panel.zip
echo cd ubuntu-web-panel
echo chmod +x deploy.sh
echo ./deploy.sh
echo.
pause
