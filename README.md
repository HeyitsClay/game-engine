# Web App with Login System

A modern full-stack web application with React frontend and Flask API backend, featuring secure JWT authentication, role-based access control, and a scalable architecture ready to grow into a bigger tool.

## 🏗️ Architecture

```
├── backend/          # Flask API
│   ├── app/
│   │   ├── api/      # API routes (auth, users, admin)
│   │   ├── models/   # Database models
│   │   ├── schemas/  # Marshmallow schemas
│   │   └── __init__.py
│   ├── config.py     # Configuration
│   ├── run.py        # Entry point
│   └── init_db.py    # Database initializer
│
└── frontend/         # React + Vite
    ├── src/
    │   ├── components/  # Reusable components
    │   ├── pages/       # Page components
    │   ├── contexts/    # React contexts
    │   ├── services/    # API services
    │   └── ...
    └── vite.config.js
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+

### Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Initialize database (creates admin account)
python init_db.py

# Run server
python run.py
```

Backend runs on http://localhost:5000

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs on http://localhost:3000

## 🔐 Default Admin Account

| Username | Password | Role |
|----------|----------|------|
| harambefan | 224 | Admin |

## 📁 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/logout` | Logout (revoke token) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get profile |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/change-password` | Change password |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Get stats |
| GET | `/api/admin/users` | List all users (paginated) |
| GET | `/api/admin/users/:id` | Get user details |
| PUT | `/api/admin/users/:id` | Update user |
| POST | `/api/admin/users/:id/toggle-admin` | Toggle admin status |
| DELETE | `/api/admin/users/:id` | Delete user |

## 🛠️ Tech Stack

### Backend
- **Flask** - Web framework
- **Flask-SQLAlchemy** - ORM
- **Flask-JWT-Extended** - JWT authentication
- **Flask-Migrate** - Database migrations
- **Flask-CORS** - Cross-origin requests
- **Marshmallow** - Data serialization

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Client-side routing
- **Axios** - HTTP client

## 🧪 Testing

### Backend
```bash
cd backend
pytest
```

### Frontend
```bash
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
# Set FLASK_ENV=production
# Use gunicorn or similar WSGI server
```

### Frontend
```bash
cd frontend
npm run build
```

## 🔧 Configuration

### Environment Variables

**Backend** (`.env`):
```
FLASK_ENV=development
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=sqlite:///app.db
```

**Frontend** (`.env`):
```
VITE_API_URL=http://localhost:5000/api
```

## 📝 Project Structure Notes

- **Backend** uses Blueprint pattern for modular API organization
- **Frontend** uses Context API for global state (auth)
- **JWT tokens** are stored in localStorage with automatic refresh
- **Database** uses SQLite by default (easy to switch to PostgreSQL)

## 🚧 Roadmap for Expansion

This architecture supports adding:
- [ ] Additional database models/entities
- [ ] More API endpoints
- [ ] File uploads
- [ ] WebSocket support
- [ ] Email notifications
- [ ] API rate limiting
- [ ] Redis for caching/sessions
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Comprehensive test suite
