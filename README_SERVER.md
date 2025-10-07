Server (optional) for persistent XLSX with admin control

1) Setup
   - cd song-formatter
   - echo "ADMIN_PASSWORD=your-strong-password" > .env
   - npm install
   - npm run start

2) Endpoints
   - GET  /api/status             -> { exists, stats }
   - GET  /api/file               -> download current.xlsx (404 if missing)
   - POST /api/upload             -> admin only (header: x-admin-password)
   - DELETE /api/file             -> admin only (header: x-admin-password)

3) Notes
   - Files stored under ./storage/current.xlsx
   - Max upload 20MB; accepts .xlsx/.xls

