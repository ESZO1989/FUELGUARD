# Instala FuelGuard como tarea programada de Windows que arranca al iniciar el equipo (sin necesidad de sesión abierta).
# Ejecutar en PowerShell como administrador, desde la carpeta del proyecto:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\instalar-servicio.ps1
# Requiere Node.js 22+ instalado y un archivo .env (copie .env.example).
$ErrorActionPreference = 'Stop'
$proyecto = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
$env = Join-Path $proyecto '.env'
if (-not (Test-Path $env)) { Copy-Item (Join-Path $proyecto '.env.example') $env; Write-Host "Creado .env a partir de .env.example: revíselo antes de exponer el servidor." }
New-Item -ItemType Directory -Force (Join-Path $proyecto 'logs') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $proyecto 'data') | Out-Null

$log = Join-Path $proyecto 'logs\fuelguard.log'
$cmd = "`"$node`" --env-file=.env server/index.js >> `"$log`" 2>&1"
$accion = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $cmd" -WorkingDirectory $proyecto
$disparador = New-ScheduledTaskTrigger -AtStartup
$config = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
Register-ScheduledTask -TaskName 'FuelGuard' -Action $accion -Trigger $disparador -Settings $config -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'FuelGuard'
Start-Sleep -Seconds 3
$estado = (Get-ScheduledTask -TaskName 'FuelGuard').State
Write-Host "Tarea 'FuelGuard' registrada. Estado: $estado"
Write-Host "Log: $log"
Write-Host "Abra el puerto en el firewall si accederán otros equipos:"
Write-Host "  New-NetFirewallRule -DisplayName FuelGuard -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow"
Write-Host "Si la base es nueva, el PIN inicial del admin aparece en el log."
