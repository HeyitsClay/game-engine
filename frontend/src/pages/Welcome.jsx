import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Welcome = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>
          Hello, {user?.username}!
        </h1>
        
        <p style={messageStyle}>
          Welcome to the application.
        </p>
        
        {user?.is_admin && (
          <span style={adminBadgeStyle}>Administrator</span>
        )}
        
        <button onClick={handleLogout} style={logoutButtonStyle}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

const containerStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '2rem',
};

const cardStyle = {
  background: 'white',
  padding: '4rem',
  borderRadius: '20px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  textAlign: 'center',
  minWidth: '400px',
};

const titleStyle = {
  fontSize: '2.5rem',
  marginBottom: '1rem',
  color: '#333',
};

const messageStyle = {
  fontSize: '1.25rem',
  color: '#666',
  marginBottom: '1.5rem',
};

const adminBadgeStyle = {
  display: 'inline-block',
  background: '#dc3545',
  color: 'white',
  padding: '0.5rem 1rem',
  borderRadius: '20px',
  fontSize: '0.875rem',
  fontWeight: 'bold',
  marginBottom: '2rem',
};

const logoutButtonStyle = {
  padding: '0.75rem 2rem',
  background: '#6c757d',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'background 0.2s',
};
