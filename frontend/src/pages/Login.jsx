import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Welcome</h1>
        <p style={subtitleStyle}>Please sign in to continue</p>
        
        {error && <div style={errorStyle}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              required
              placeholder="Username"
            />
          </div>
          
          <div style={formGroupStyle}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
              placeholder="Password"
            />
          </div>
          
          <button 
            type="submit" 
            style={buttonStyle}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div style={hintStyle}>
          <small>Admin: harambefan / 224</small>
        </div>
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
  padding: '3rem',
  borderRadius: '20px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  width: '100%',
  maxWidth: '400px',
  textAlign: 'center',
};

const titleStyle = {
  fontSize: '2.5rem',
  marginBottom: '0.5rem',
  color: '#333',
};

const subtitleStyle = {
  color: '#666',
  marginBottom: '2rem',
};

const formGroupStyle = {
  marginBottom: '1.25rem',
};

const inputStyle = {
  width: '100%',
  padding: '1rem',
  border: '2px solid #e0e0e0',
  borderRadius: '10px',
  fontSize: '1rem',
  boxSizing: 'border-box',
  transition: 'border-color 0.3s',
};

const buttonStyle = {
  width: '100%',
  padding: '1rem',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '1.1rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform 0.2s, box-shadow 0.2s',
  marginTop: '0.5rem',
};

const errorStyle = {
  background: '#f8d7da',
  color: '#721c24',
  padding: '1rem',
  borderRadius: '8px',
  marginBottom: '1rem',
};

const hintStyle = {
  marginTop: '1.5rem',
  color: '#999',
};
