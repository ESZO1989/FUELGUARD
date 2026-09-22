# Detiene y elimina la tarea programada de FuelGuard. Ejecutar como administrador.
$ErrorActionPreference = 'SilentlyContinue'
Stop-ScheduledTask -TaskName 'FuelGuard'
Get-Process node | Where-Object { $_.Path -and (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*server/index.js*' } | Stop-Process -Force
Unregister-ScheduledTask -TaskName 'FuelGuard' -Confirm:$false
Write-Host "Tarea 'FuelGuard' eliminada. La base de datos y los respaldos no se tocan."
