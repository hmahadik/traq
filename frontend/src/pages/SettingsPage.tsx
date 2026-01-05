import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// Settings is now a drawer, redirect to timeline
export function SettingsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/');
  }, [navigate]);

  return null;
}
