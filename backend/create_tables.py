from app.database import engine
from app import models
models.Base.metadata.create_all(bind=engine)
print("All tables created successfully!")
import sqlite3
conn = sqlite3.connect('hospital.db')
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", [t[0] for t in tables])
conn.close()
