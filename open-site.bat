@echo off
echo 🚀 Opening CRM System...
echo.
echo ✅ API Server: http://localhost:3000
echo ✅ Web App: http://localhost:5173  
echo ✅ Admin Panel: http://localhost:5174
echo.
echo Login with:
echo   Email: demo@crm.com
echo   Password: test123
echo.
start http://localhost:5173
start http://localhost:5174
echo ✅ Sites opened in browser!
pause
