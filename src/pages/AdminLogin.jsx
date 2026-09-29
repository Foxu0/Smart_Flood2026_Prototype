import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EocLoginTerminal from '../components/EocLoginTerminal.jsx';

export default function AdminLogin() {
  const navigate = useNavigate();

  // If already authenticated, redirect straight to /admin
  useEffect(() => {
    const token = sessionStorage.getItem('sf_token');
    if (token) {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  return (
    <div
      className="min-h-screen w-full font-sans text-[#3f5361] py-8 px-4 flex flex-col justify-center items-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(10,25,38,0.92) 0%, rgba(13,38,58,0.96) 50%, rgba(7,18,28,0.98) 100%)',
      }}
    >
      {/* Background ambient wave accent */}
      <div
        className="absolute top-0 left-0 w-full pointer-events-none opacity-30 select-none overflow-hidden"
      >
        <div className="flood-wave-anim" style={{ animationDuration: '7s' }}>
          <svg viewBox="0 0 1440 80" style={{ width: '100vw', display: 'block', flexShrink: 0, height: 80 }} preserveAspectRatio="none">
            <path d="M0,40 C360,90 720,-10 1440,40 L1440,80 L0,80 Z" fill="rgba(127,196,224,0.15)" />
          </svg>
          <svg viewBox="0 0 1440 80" style={{ width: '100vw', display: 'block', flexShrink: 0, height: 80 }} preserveAspectRatio="none">
            <path d="M0,40 C360,90 720,-10 1440,40 L1440,80 L0,80 Z" fill="rgba(127,196,224,0.15)" />
          </svg>
        </div>
      </div>

      <div className="relative z-10 w-full flex justify-center">
        <EocLoginTerminal onLoginSuccess={() => navigate('/admin', { replace: true })} />
      </div>
    </div>
  );
}

