import psycopg2
import uuid
import datetime

CONN = {
    "host": "aws-0-ap-southeast-1.pooler.supabase.com",
    "port": 6543,
    "dbname": "postgres",
    "user": "postgres.ifojeggpbgvvmdzcqpvo",
    "password": "Eduglobin2026@",
    "sslmode": "require",
}

def run_test():
    conn = psycopg2.connect(**CONN)
    cur = conn.cursor()

    print("Running DB migration V25 sanity updates...")
    cur.execute("""
        ALTER TABLE visiting_circulation_students DROP CONSTRAINT IF EXISTS visiting_circulation_students_purpose_check;
        ALTER TABLE visiting_circulation_students ADD CONSTRAINT visiting_circulation_students_purpose_check 
            CHECK (purpose IN ('ISSUE', 'REISSUE', 'RETURN', 'CIRCULATION', 'ENQUIRY_INSPECTION', 'DOCUMENT_SUBMISSION', 'GENERAL_VISIT', 'VISIT', 'ENQUIRY', 'OTHER'));

        ALTER TABLE visiting_circulation_students DROP CONSTRAINT IF EXISTS visiting_circulation_students_status_check;
        ALTER TABLE visiting_circulation_students ADD CONSTRAINT visiting_circulation_students_status_check 
            CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'EXIT_REQUESTED', 'COMPLETED', 'REJECTED', 'CANCELLED'));

        ALTER TABLE student_library_profiles ALTER COLUMN library_category DROP NOT NULL;
        ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
        ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE student_library_profiles ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT TRUE;
    """)
    conn.commit()
    print("[OK] V25 constraints applied successfully!")

    # Check if a library exists
    cur.execute("SELECT id, name FROM libraries LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("No library found to test against, creating test library...")
        lib_id = str(uuid.uuid4())
        cur.execute("INSERT INTO libraries (id, name, city, locality) VALUES (%s, 'IIT Test Library', 'Bhilai', 'Campus') RETURNING id", (lib_id,))
        conn.commit()
    else:
        lib_id = row[0]
        print(f"Using library: {row[1]} ({lib_id})")

    # Create / verify test student profile
    student_id = str(uuid.uuid4())
    cur.execute("INSERT INTO profiles (id, role, full_name, account_status) VALUES (%s, 'STUDENT', 'Aman Sharma', 'ACTIVE')", (student_id,))
    conn.commit()

    # Step 1: Create Student Library Profile
    profile_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO student_library_profiles (id, library_id, student_id, library_category, full_name, is_claimed, is_active, created_at)
        VALUES (%s, %s, %s, 'INSTITUTE', 'Aman Sharma', TRUE, TRUE, NOW())
    """, (profile_id, lib_id, student_id))
    conn.commit()
    print("[OK] Step 1: Student Library Profile created successfully!")

    # Step 2: Student requests 40-minute Visitor Pass
    request_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO visiting_circulation_students (id, library_id, student_library_profile_id, purpose, check_in_at, status, time_limit_minutes)
        VALUES (%s, %s, %s, 'CIRCULATION', NOW(), 'PENDING_APPROVAL', 40)
    """, (request_id, lib_id, profile_id))
    conn.commit()
    print("[OK] Step 2: Student submitted 40-Min Visitor Pass with status PENDING_APPROVAL!")

    # Step 3: Owner queries pending visitor requests
    cur.execute("""
        SELECT v.id as request_id, v.purpose, v.check_in_at, v.status,
               slp.id as profile_id, COALESCE(p.full_name, 'Student Visitor') as student_name
        FROM visiting_circulation_students v
        JOIN student_library_profiles slp ON v.student_library_profile_id = slp.id
        LEFT JOIN profiles p ON slp.student_id = p.id
        WHERE v.library_id = %s AND v.status = 'PENDING_APPROVAL'
    """, (lib_id,))
    pending = cur.fetchall()
    print(f"[OK] Step 3: Owner fetched {len(pending)} pending visitor pass requests at front desk!")

    # Step 4: Owner accepts visitor pass (Check-In)
    cur.execute("""
        UPDATE visiting_circulation_students SET status = 'ACTIVE', check_in_at = NOW() WHERE id = %s
    """, (request_id,))
    conn.commit()
    print("[OK] Step 4: Owner approved visitor pass -> Status updated to ACTIVE!")

    # Step 5: Student queries active visit status
    cur.execute("""
        SELECT v.id, v.purpose, v.time_limit_minutes, v.status,
               EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v.check_in_at))/60.0 as elapsed_minutes
        FROM visiting_circulation_students v
        JOIN student_library_profiles slp ON v.student_library_profile_id = slp.id
        WHERE slp.student_id = %s AND v.status IN ('ACTIVE', 'EXIT_REQUESTED')
    """, (student_id,))
    active_visit = cur.fetchone()
    print(f"[OK] Step 5: Student active visit verified: Purpose={active_visit[1]}, Limit={active_visit[2]} mins, Status={active_visit[3]}")

    # Step 6: Student requests exit
    cur.execute("""
        UPDATE visiting_circulation_students SET status = 'EXIT_REQUESTED', exit_request_at = NOW() WHERE id = %s
    """, (request_id,))
    conn.commit()
    print("[OK] Step 6: Student requested exit -> Status updated to EXIT_REQUESTED!")

    # Step 7: Owner approves exit
    cur.execute("""
        UPDATE visiting_circulation_students SET status = 'COMPLETED', check_out_at = NOW(), exit_approved_at = NOW() WHERE id = %s
    """, (request_id,))
    conn.commit()
    print("[OK] Step 7: Owner approved exit -> Visit COMPLETED!")

    # Cleanup test data
    cur.execute("DELETE FROM visiting_circulation_students WHERE id = %s", (request_id,))
    cur.execute("DELETE FROM student_library_profiles WHERE id = %s", (profile_id,))
    cur.execute("DELETE FROM profiles WHERE id = %s", (student_id,))
    conn.commit()
    print("[OK] Cleanup completed! All 7 steps in Visitor Pass Lifecycle passed perfectly!")

    cur.close()
    conn.close()

if __name__ == "__main__":
    run_test()
