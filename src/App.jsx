import React, { useState, useEffect } from 'react';
import OmkarCustomer from './CustomerApp';
import OmkarOwner from './OwnerApp';

export default function App() {
  const [role, setRole] = useState(() => sessionStorage.getItem('omkar_role') || null);

  useEffect(() => {
    if (role) sessionStorage.setItem('omkar_role', role);
    else sessionStorage.removeItem('omkar_role');
  }, [role]);

  if (!role) {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="text-6xl mb-4">🍛</div>
          <h1 className="text-3xl font-bold text-green-600 mb-2">Omkar Caterers</h1>
          <p className="text-gray-600 mb-8">✓ 100% PURE VEGETARIAN</p>
          <div className="space-y-4">
            <button onClick={() => setRole('customer')} className="w-full bg-green-600 text-white font-bold py-4 rounded-lg text-lg">👤 Customer</button>
            <button onClick={() => setRole('owner')} className="w-full bg-purple-600 text-white font-bold py-4 rounded-lg text-lg">👑 Owner</button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'customer') return <OmkarCustomer onExitRole={() => setRole(null)} />;
  return <OmkarOwner onExitRole={() => setRole(null)} />;
}
