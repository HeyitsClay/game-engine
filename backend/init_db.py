#!/usr/bin/env python3
"""Initialize database and create admin user"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models.user import User

def init_database():
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("[OK] Database tables created")
        
        # Check if admin exists
        admin = User.query.filter_by(username='harambefan').first()
        
        if not admin:
            admin = User(
                username='harambefan',
                email='admin@example.com',
                is_admin=True,
                is_active=True
            )
            admin.set_password('224')
            db.session.add(admin)
            db.session.commit()
            print("[OK] Admin account 'harambefan' created successfully!")
        else:
            print("[INFO] Admin account 'harambefan' already exists")
        
        print("\n[DONE] Database initialization complete!")

if __name__ == '__main__':
    init_database()
