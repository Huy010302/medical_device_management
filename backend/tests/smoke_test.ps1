# PowerShell 5.1+; creates TWO real workflow records. Use on demo DB only.
param(
    [string] $BaseUrl = 'http://127.0.0.1:8000',
    [string] $AdminEmail = 'admin2@benhvien.local',
    [string] $AdminPassword = '',
    [switch] $CheckSpark
)
$ErrorActionPreference = 'Stop'
if (-not $AdminPassword) {
    $credential = Get-Credential -UserName $AdminEmail -Message 'Password of the seeded MedDevice administrator'
    $AdminEmail = $credential.UserName
    $AdminPassword = $credential.GetNetworkCredential().Password
}
$health = Invoke-RestMethod "$BaseUrl/health"
if ($health.status -ne 'ok') { throw "Backend health check failed" }
$login = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
$token = (Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body $login).access_token
if (-not $token) { throw 'Missing JWT' }
$headers = @{ Authorization = "Bearer $token" }
$me = Invoke-RestMethod "$BaseUrl/api/auth/me" -Headers $headers
if ($me.role_code -ne 'admin') { throw 'This test requires an admin account' }
$before = (Invoke-RestMethod "$BaseUrl/api/analytics/events/count" -Headers $headers).events
$deviceId = [guid]::NewGuid().ToString()
$device = @{ id = $deviceId; device_code = "DEMO-$($deviceId.Substring(0, 8))"; name = 'Smoke-test medical device'; current_status = 'operating'; qr_token = [guid]::NewGuid().ToString(); created_at = (Get-Date).ToUniversalTime().ToString('o') }
$created = Invoke-RestMethod "$BaseUrl/api/records/devices/$deviceId" -Method Put -Headers $headers -ContentType 'application/json' -Body (@{ payload = $device } | ConvertTo-Json -Depth 20)
if ($created.id -ne $deviceId) { throw 'Device creation returned an unexpected ID' }
$records = Invoke-RestMethod "$BaseUrl/api/records/devices" -Headers $headers
if (-not @($records | Where-Object { $_.id -eq $deviceId }).Count) { throw 'PostgreSQL did not return the saved device' }
$maintId = [guid]::NewGuid().ToString()
$maint = @{ id = $maintId; device_id = $deviceId; result = 'completed'; actual_date = (Get-Date).ToString('yyyy-MM-dd') }
Invoke-RestMethod "$BaseUrl/api/records/maintenance_records/$maintId" -Method Put -Headers $headers -ContentType 'application/json' -Body (@{ payload = $maint } | ConvertTo-Json -Depth 20) | Out-Null
$after = (Invoke-RestMethod "$BaseUrl/api/analytics/events/count" -Headers $headers).events
if ($after -ne $before + 2) { throw "Expected 2 committed events; before=$before after=$after" }
$qr = Invoke-RestMethod "$BaseUrl/api/qr/$($device.qr_token)"
if ($qr.id -ne $deviceId -or $qr.PSObject.Properties.Name -contains 'notes') { throw 'Public QR contract failed' }
Write-Host "PASS: health -> JWT -> device saved/reloaded -> maintenance -> 2 committed events -> public QR" -ForegroundColor Green
Write-Host "Created test device: $deviceId; event count: $after. Export events and run Spark next."
if ($CheckSpark) {
    $report = Invoke-RestMethod "$BaseUrl/api/analytics/bigdata" -Headers $headers
    if ($report.source -ne 'spark_csv' -or -not $report.datasets.lifecycle_event_summary) { throw 'Spark export missing or invalid' }
    Write-Host 'PASS: FastAPI is serving generated Spark CSV analytics.' -ForegroundColor Green
}
