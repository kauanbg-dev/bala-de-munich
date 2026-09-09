$root = "C:\Users\Scanner\bala-de-munich"
$votesFile = Join-Path $root "data\votes.json"
$allow = @(
  "TTeuw", "Brkk", "DG", "Davasco", "Nebacetin", "Bluue",
  "Pedro Sem Freio", "luccaf14", "Gordin", "Baraka", "Vini Show",
  "Jmdeck", "Beliene157", "2Tclipes"
)
$pollId = "quartas-raposo"
$durationHours = 2
$startPin = "tteuw"

function Get-Votes {
  $store = @{ polls = @{} }
  if (-not (Test-Path $votesFile)) { return $store }
  try {
    $raw = Get-Content -LiteralPath $votesFile -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return $store }
    $obj = $raw | ConvertFrom-Json
    if (-not $obj.polls) { return $store }
    foreach ($p in $obj.polls.PSObject.Properties) {
      $ballots = @{}
      if ($p.Value.ballots) {
        foreach ($v in $p.Value.ballots.PSObject.Properties) {
          $ballots[$v.Name] = [string]$v.Value
        }
      }
      $startedAt = $null
      if ($p.Value.startedAt) { $startedAt = [string]$p.Value.startedAt }
      $endsAt = $null
      if ($p.Value.endsAt) { $endsAt = [string]$p.Value.endsAt }
      $paused = $false
      if ($p.Value.paused) { $paused = [bool]$p.Value.paused }
      $remainingMs = 0
      if ($null -ne $p.Value.remainingMs) { $remainingMs = [int]$p.Value.remainingMs }
      $store.polls[$p.Name] = @{
        ballots = $ballots
        startedAt = $startedAt
        endsAt = $endsAt
        paused = $paused
        remainingMs = $remainingMs
      }
    }
  } catch {}
  return $store
}

function Save-Votes($store) {
  $dir = Split-Path $votesFile
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Add-Type -AssemblyName System.Web.Extensions
  $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $ser.MaxJsonLength = 20MB
  $json = $ser.Serialize($store)
  [IO.File]::WriteAllText($votesFile, $json, [Text.UTF8Encoding]::new($false))
}

function Get-Totals($ballots) {
  $totals = @{}
  if ($ballots) {
    foreach ($vote in $ballots.Values) {
      if (-not $totals.ContainsKey($vote)) { $totals[$vote] = 0 }
      $totals[$vote]++
    }
  }
  return $totals
}

function Parse-IsoStamp($value) {
  if (-not $value) { return $null }
  try {
    return [datetime]::Parse(
      [string]$value,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::RoundtripKind
    ).ToUniversalTime()
  } catch { return $null }
}

function Get-Window($poll) {
  $startedAt = Parse-IsoStamp $poll.startedAt
  $endsAt = Parse-IsoStamp $poll.endsAt
  $paused = [bool]$poll.paused
  $now = [datetime]::UtcNow
  if ($startedAt -and -not $endsAt) { $endsAt = $startedAt.AddHours($durationHours) }
  $remainingMs = 0
  $open = $false
  if ($startedAt) {
    if ($paused) {
      if ($null -ne $poll.remainingMs) { $remainingMs = [int][math]::Max(0, $poll.remainingMs) }
    } elseif ($endsAt) {
      if ($now -lt $endsAt) {
        $open = $true
        $remainingMs = [int][math]::Max(0, ($endsAt - $now).TotalMilliseconds)
      }
    }
  }
  $isoStart = $null
  $isoEnd = $null
  if ($startedAt) { $isoStart = $startedAt.ToString("o") }
  if ($endsAt) { $isoEnd = $endsAt.ToString("o") }
  return @{
    started = [bool]$startedAt
    open = $open
    paused = $paused
    startedAt = $isoStart
    endsAt = $isoEnd
    remainingMs = $remainingMs
    durationHours = $durationHours
  }
}

function Mvp-Payload($poll, $voter) {
  $mine = $null
  if ($poll.ballots -and $poll.ballots.ContainsKey($voter)) { $mine = [string]$poll.ballots[$voter] }
  $totals = Get-Totals $poll.ballots
  $total = 0
  foreach ($n in $totals.Values) { $total += $n }
  $win = Get-Window $poll
  return @{
    poll = $pollId
    open = $win.open
    paused = $win.paused
    started = $win.started
    startedAt = $win.startedAt
    endsAt = $win.endsAt
    remainingMs = $win.remainingMs
    durationHours = $win.durationHours
    total = $total
    totals = $totals
    voted = [bool]$mine
    mine = $mine
  }
}

function Read-VoterId($ctx) {
  foreach ($cookie in $ctx.Request.Cookies) {
    if ($cookie.Name -eq "mvp_vid" -and $cookie.Value) { return $cookie.Value }
  }
  return $null
}

function Write-VoterCookie($ctx, $id) {
  $ctx.Response.Headers.Add("Set-Cookie", "mvp_vid=$id; Path=/; HttpOnly; Max-Age=31536000; SameSite=Lax")
}

function Write-Json($ctx, $obj, $status = 200) {
  $json = $obj | ConvertTo-Json -Compress -Depth 8
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.Headers["Cache-Control"] = "no-store"
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Handle-Mvp($ctx) {
  $voter = Read-VoterId $ctx
  $fresh = $false
  if (-not $voter) {
    $voter = [guid]::NewGuid().ToString("N")
    $fresh = $true
  }
  if ($fresh) { Write-VoterCookie $ctx $voter }

  $store = Get-Votes
  if (-not $store.polls) { $store.polls = @{} }
  if (-not $store.polls.ContainsKey($pollId)) {
    $store.polls[$pollId] = @{ ballots = @{}; startedAt = $null; endsAt = $null; paused = $false; remainingMs = 0 }
  }
  $poll = $store.polls[$pollId]
  if (-not $poll.ballots) { $poll.ballots = @{} }
  if (-not $poll.ContainsKey("startedAt")) { $poll.startedAt = $null }
  if (-not $poll.ContainsKey("endsAt")) { $poll.endsAt = $null }
  if (-not $poll.ContainsKey("paused")) { $poll.paused = $false }
  if (-not $poll.ContainsKey("remainingMs")) { $poll.remainingMs = 0 }

  if ($ctx.Request.HttpMethod -eq "GET") {
    Write-Json $ctx (Mvp-Payload $poll $voter)
    return
  }

  if ($ctx.Request.HttpMethod -ne "POST") {
    Write-Json $ctx @{ error = "method" } 405
    return
  }

  $reader = New-Object IO.StreamReader($ctx.Request.InputStream, $ctx.Request.ContentEncoding)
  $raw = $reader.ReadToEnd()
  $reader.Close()
  try { $body = $raw | ConvertFrom-Json } catch {
    Write-Json $ctx @{ error = "json" } 400
    return
  }

  $action = [string]$body.action
  $adminActions = @("auth", "start", "pause", "resume")
  if ($adminActions -contains $action) {
    if ([string]$body.pin -ne $startPin) {
      Write-Json $ctx @{ error = "pin" } 403
      return
    }
    if ($action -eq "auth") {
      Write-Json $ctx @{ ok = $true }
      return
    }
    $win = Get-Window $poll
    $now = [datetime]::UtcNow
    if ($action -eq "start") {
      if ($win.started) {
        Write-Json $ctx (Mvp-Payload $poll $voter) 409
        return
      }
      $poll.startedAt = $now.ToString("o")
      $poll.endsAt = $now.AddHours($durationHours).ToString("o")
      $poll.paused = $false
      $poll.remainingMs = [int]([timespan]::FromHours($durationHours).TotalMilliseconds)
    } elseif ($action -eq "pause") {
      if (-not $win.open) {
        Write-Json $ctx (Mvp-Payload $poll $voter) 409
        return
      }
      $poll.paused = $true
      $poll.remainingMs = $win.remainingMs
    } elseif ($action -eq "resume") {
      if (-not $win.started -or -not $win.paused -or $win.remainingMs -le 0) {
        Write-Json $ctx (Mvp-Payload $poll $voter) 409
        return
      }
      $poll.paused = $false
      $poll.endsAt = $now.AddMilliseconds($poll.remainingMs).ToString("o")
    }
    $store.polls[$pollId] = $poll
    Save-Votes $store
    Write-Json $ctx (Mvp-Payload $poll $voter)
    return
  }

  $player = [string]$body.player
  $reqPoll = [string]$body.poll
  if ($reqPoll -ne $pollId -or $allow -notcontains $player) {
    Write-Json $ctx @{ error = "invalid" } 400
    return
  }
  $win = Get-Window $poll
  if (-not $win.started) {
    Write-Json $ctx (Mvp-Payload $poll $voter) 403
    return
  }
  if (-not $win.open) {
    Write-Json $ctx (Mvp-Payload $poll $voter) 403
    return
  }
  $payload = Mvp-Payload $poll $voter
  if ($payload.voted) {
    Write-Json $ctx $payload 409
    return
  }

  $poll.ballots[$voter] = $player
  $store.polls[$pollId] = $poll
  Save-Votes $store
  Write-Json $ctx (Mvp-Payload $poll $voter)
}

$listener = $null
foreach ($port in 8765, 8766, 8767, 8768, 8769) {
  try {
    $candidate = [System.Net.HttpListener]::new()
    $candidate.Prefixes.Add("http://127.0.0.1:$port/")
    $candidate.Start()
    $listener = $candidate
    Write-Output "listening $port"
    break
  } catch {}
}
if (-not $listener) { throw "Nenhuma porta livre (8765-8768)." }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.LocalPath)
  try {
    if ($path -eq "/api/mvp") {
      Handle-Mvp $ctx
    } else {
      if ($path -eq "/") { $path = "/index.html" }
      $file = Join-Path $root ($path.TrimStart("/").Replace("/", "\"))
      if (Test-Path $file -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $type = switch ($ext) {
          ".html" { "text/html; charset=utf-8" }
          ".css" { "text/css; charset=utf-8" }
          ".js" { "text/javascript; charset=utf-8" }
          ".json" { "application/json; charset=utf-8" }
          ".jpg" { "image/jpeg" }
          ".jpeg" { "image/jpeg" }
          ".png" { "image/png" }
          ".svg" { "image/svg+xml" }
          default { "application/octet-stream" }
        }
        $bytes = [IO.File]::ReadAllBytes($file)
        $ctx.Response.ContentType = $type
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
      }
    }
  } catch {
    $ctx.Response.StatusCode = 500
  }
  $ctx.Response.Close()
}
