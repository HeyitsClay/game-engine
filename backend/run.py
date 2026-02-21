#!/usr/bin/env python3
"""Run the Flask application"""
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app = create_app()

if __name__ == '__main__':
    # Initialize database if it doesn't exist
    from app import db
    from app.models.user import User
    
    with app.app_context():
        db.create_all()
        
        # Create admin if not exists
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
            print("[OK] Admin account 'harambefan' created!")
    
    print("\n[START] Server running on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
