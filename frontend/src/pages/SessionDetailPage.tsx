import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * SessionDetailPage - Thin wrapper that redirects /session/:id to timeline with drawer
 * This maintains backward compatibility for direct session links
 */
export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      // Redirect to timeline with sessionId param to open drawer
      navigate(`/timeline?sessionId=${id}`, { replace: true });
    }
  }, [id, navigate]);

  return null;
}
