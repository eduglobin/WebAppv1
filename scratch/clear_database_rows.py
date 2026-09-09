import psycopg2
import sys

CONN = {
    "host": "aws-0-ap-southeast-1.pooler.supabase.com",
    "port": 6543,
    "dbname": "postgres",
    "user": "postgres.ifojeggpbgvvmdzcqpvo",
    "password": "Eduglobin2026@",
    "sslmode": "require",
}

# Tables to truncate (operational data)
OPERATIONAL_TABLES = [
    "audit_logs",
    "booking_timeline",
    "booking_disputes",
    "checkin_scan_logs",
    "item_log_entries",
    "complaint_tickets",
    "community_replies",
    "community_threads",
    "book_loans",
    "visiting_circulation_students",
    "library_book_catalog",
    "owner_cancellation_requests",
    "seat_queue_entries",
    "session_topups",
    "student_crm_records",
    "student_library_profiles",
    "wallet_transactions",
    "student_wallets",
    "points_coins_ledger",
    "bookings",
    "seat_desks",
    "shifts",
    "lockers",
    "libraries",
    "profiles",
]

def clear_rows():
    print("Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(**CONN)
    conn.autocommit = False
    cur = conn.cursor()

    print("\n--- Truncating operational tables ---")
    for table in OPERATIONAL_TABLES:
        try:
            cur.execute(f'TRUNCATE TABLE "{table}" CASCADE;')
            print(f"  [OK] Truncated: {table}")
        except Exception as e:
            print(f"  [SKIP/ERR] {table}: {e}")
            conn.rollback()

    conn.commit()

    print("\n--- Clearing auth.users ---")
    try:
        cur.execute("DELETE FROM auth.users WHERE email NOT LIKE '%@supabase.io';")
        print(f"  [OK] Deleted test users from auth.users (count: {cur.rowcount})")
        conn.commit()
    except Exception as e:
        print(f"  [NOTE] auth.users deletion notice: {e}")
        conn.rollback()

    print("\n--- Verifying Row Counts ---")
    for table in OPERATIONAL_TABLES:
        try:
            cur.execute(f'SELECT count(*) FROM "{table}"')
            cnt = cur.fetchone()[0]
            print(f"  {table}: {cnt} rows")
        except Exception as e:
            print(f"  {table}: error counting ({e})")
            conn.rollback()

    cur.close()
    conn.close()
    print("\nDatabase row cleanup complete! Schema and seed tables remain intact.")

if __name__ == "__main__":
    clear_rows()
