import psycopg2

CONN = {
    "host": "aws-0-ap-southeast-1.pooler.supabase.com",
    "port": 6543,
    "dbname": "postgres",
    "user": "postgres.ifojeggpbgvvmdzcqpvo",
    "password": "Eduglobin2026@",
    "sslmode": "require",
}

def main():
    conn = psycopg2.connect(**CONN)
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [row[0] for row in cur.fetchall()]
    print("Tables in public schema:")
    for t in tables:
        try:
            cur.execute(f'SELECT count(*) FROM "{t}"')
            cnt = cur.fetchone()[0]
            print(f"  {t}: {cnt} rows")
        except Exception as e:
            print(f"  {t}: error counting ({e})")
            conn.rollback()
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
