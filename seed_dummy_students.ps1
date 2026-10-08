$dbHost = "aws-0-ap-southeast-1.pooler.supabase.com"
$dbPort = "6543"
$dbName = "postgres"
$dbUser = "postgres.ifojeggpbgvvmdzcqpvo"
$dbPass = "Eduglobin2026@"
$connString = "Host=$dbHost;Port=$dbPort;Database=$dbName;Username=$dbUser;Password=$dbPass;SslMode=Require"

# Download Npgsql if not present
if (-not (Test-Path "Npgsql.dll")) {
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/Npgsql/8.0.2" -OutFile "Npgsql.zip"
    Expand-Archive "Npgsql.zip" -DestinationPath "Npgsql" -Force
    Copy-Item "Npgsql\lib\net8.0\Npgsql.dll" -Destination "."
}
Add-Type -Path ".\Npgsql.dll"

Write-Host "Waiting for 'xyz library' to be approved..."
while ($true) {
    $conn = New-Object Npgsql.NpgsqlConnection($connString)
    $conn.Open()
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT id FROM libraries WHERE name ILIKE '%xyz%' AND status = 'PUBLISHED' LIMIT 1"
    $reader = $cmd.ExecuteReader()
    
    if ($reader.Read()) {
        $libId = $reader.GetGuid(0)
        $reader.Close()
        Write-Host "Found library: $libId. Seeding students..."
        
        # Get 16 available seats
        $seatCmd = $conn.CreateCommand()
        $seatCmd.CommandText = "SELECT id FROM seat_desks WHERE library_id = '$libId' LIMIT 16"
        $seatReader = $seatCmd.ExecuteReader()
        $seats = @()
        while ($seatReader.Read()) {
            $seats += $seatReader.GetGuid(0)
        }
        $seatReader.Close()
        
        # Create 16 dummy students and check them in
        for ($i = 0; $i -lt $seats.Length; $i++) {
            $seatId = $seats[$i]
            $studentId = [guid]::NewGuid()
            $name = "Dummy Student $($i+1)"
            $email = "dummy$($i+1)@test.com"
            $phone = "99988877$($i.ToString('00'))"
            
            $insertStudent = $conn.CreateCommand()
            $insertStudent.CommandText = "INSERT INTO student_library_profiles (id, student_name, contact_number, user_id) VALUES ('$studentId', '$name', '$phone', gen_random_uuid())"
            $insertStudent.ExecuteNonQuery()
            
            # Create active enrollment
            $insertEnrollment = $conn.CreateCommand()
            $insertEnrollment.CommandText = "INSERT INTO monthly_seat_enrollments (id, library_id, seat_id, student_library_profile_id, status, current_period_start, current_period_end, qr_payload, is_currently_checked_in) VALUES (gen_random_uuid(), '$libId', '$seatId', '$studentId', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', gen_random_uuid(), true)"
            $insertEnrollment.ExecuteNonQuery()
            
            # Create active session
            $insertSession = $conn.CreateCommand()
            $insertSession.CommandText = "INSERT INTO student_sessions (id, student_library_profile_id, seat_desk_id, library_id, check_in_time) VALUES (gen_random_uuid(), '$studentId', '$seatId', '$libId', NOW())"
            $insertSession.ExecuteNonQuery()
        }
        
        Write-Host "Seeded 16 dummy students successfully!"
        $conn.Close()
        break
    }
    
    $reader.Close()
    $conn.Close()
    Start-Sleep -Seconds 3
}
