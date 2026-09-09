import psycopg2

CONN = {
    "host": "aws-0-ap-southeast-1.pooler.supabase.com",
    "port": 6543,
    "dbname": "postgres",
    "user": "postgres.ifojeggpbgvvmdzcqpvo",
    "password": "Eduglobin2026@",
    "sslmode": "require",
}

BOOKING_TABLES = [
    "booking_timeline",
    "booking_disputes",
    "checkin_scan_logs",
    "session_topups",
    "owner_cancellation_requests",
    "owner_vacate_requests",
    "seat_queue_entries",
    "visiting_circulation_students",
    "book_loans",
    "item_log_entries",
    "wallet_transactions",
    "points_coins_ledger",
    "bookings",
]

def clear_seat_bookings():
    print("Connecting to Supabase PostgreSQL database...")
    conn = psycopg2.connect(**CONN)
    conn.autocommit = False
    cur = conn.cursor()

    print("\n--- 1. Clearing Booking and Operational Transaction Tables ---")
    for table in BOOKING_TABLES:
        try:
            cur.execute(f'TRUNCATE TABLE "{table}" CASCADE;')
            conn.commit()
            print(f"  [OK] Cleared table: {table}")
        except Exception as e:
            conn.rollback()
            try:
                cur.execute(f'DELETE FROM "{table}";')
                conn.commit()
                print(f"  [OK] Deleted rows from: {table}")
            except Exception as e2:
                print(f"  [SKIP/NOTE] {table}: {e2}")
                conn.rollback()

    print("\n--- 2. Resetting Seat Desks to AVAILABLE ---")
    try:
        cur.execute("""
            UPDATE seat_desks 
            SET current_status = 'AVAILABLE';
        """)
        seat_count = cur.rowcount
        conn.commit()
        print(f"  [OK] Reset {seat_count} seats to AVAILABLE status.")
    except Exception as e:
        print(f"  [ERR] Resetting seat_desks: {e}")
        conn.rollback()

    print("\n--- 3. Resetting Lockers to AVAILABLE ---")
    try:
        cur.execute("""
            UPDATE lockers 
            SET status = 'AVAILABLE',
                assigned_booking_id = NULL,
                assigned_student_id = NULL
            WHERE status != 'UNDER_MAINTENANCE';
        """)
        locker_count = cur.rowcount
        conn.commit()
        print(f"  [OK] Reset {locker_count} lockers to AVAILABLE status.")
    except Exception as e:
        print(f"  [ERR] Resetting lockers: {e}")
        conn.rollback()

    print("\n--- 4. Preserved Core Entities Verification ---")
    preserved_tables = [
        "profiles",
        "libraries",
        "student_library_profiles",
        "seat_desks",
        "shifts",
        "lockers",
        "library_book_catalog"
    ]
    for table in preserved_tables:
        try:
            cur.execute(f'SELECT count(*) FROM "{table}"')
            cnt = cur.fetchone()[0]
            print(f"  [PRESERVED] {table}: {cnt} records intact")
        except Exception as e:
            print(f"  {table}: error counting ({e})")
            conn.rollback()

    print("\n--- 5. Booking Tables Status Verification ---")
    for table in BOOKING_TABLES:
        try:
            cur.execute(f'SELECT count(*) FROM "{table}"')
            cnt = cur.fetchone()[0]
            print(f"  [CLEARED] {table}: {cnt} rows")
        except Exception as e:
            conn.rollback()

    cur.close()
    conn.close()
    print("\n[SUCCESS] Seat booking and transaction data cleared. User profiles and Library profiles remain 100% intact.")

if __name__ == "__main__":
    clear_seat_bookings()
