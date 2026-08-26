"use client";

import React, { useState } from 'react';

export default function ScopeManagerModal({ onClose, onRegroup }: any) {
  const [targetType, setTargetType] = useState('user');
  
  const [oldFamily, setOldFamily] = useState('');
  const [oldUser, setOldUser] = useState('');
  const [oldBroker, setOldBroker] = useState('');

  const [newFamily, setNewFamily] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newBroker, setNewBroker] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/portfolio/advancedRegroup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          oldFamilyId: oldFamily,
          oldUserId: oldUser,
          oldBrokerId: oldBroker,
          newFamilyId: newFamily,
          newUserId: newUser,
          newBrokerId: newBroker
        })
      });
      if (!res.ok) throw new Error('Regroup failed');
      alert('Scope successfully regrouped!');
      onRegroup(); // trigger refresh
      onClose();
    } catch(e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="glass-card" style={{ width: '400px', padding: '24px', background: 'var(--bg-card)' }}>
        <h2 className="brand-name" style={{ fontSize: '18px', marginBottom: '16px' }}>Scope <span>Manager</span></h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Move What?</label>
          <select value={targetType} onChange={e => setTargetType(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px' }}>
            <option value="user">Move a User (and all their brokers) to another Family</option>
            <option value="broker">Move a Broker to another User</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }}></div>
        
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--ms-gold)', marginBottom: '12px' }}>FROM</h3>
        <input type="text" placeholder="Old Family ID" value={oldFamily} onChange={e => setOldFamily(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />
        <input type="text" placeholder="Old User ID" value={oldUser} onChange={e => setOldUser(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />
        {targetType === 'broker' && <input type="text" placeholder="Old Broker ID" value={oldBroker} onChange={e => setOldBroker(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />}

        <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }}></div>

        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-positive)', marginBottom: '12px' }}>TO</h3>
        <input type="text" placeholder="New Family ID" value={newFamily} onChange={e => setNewFamily(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />
        {targetType === 'broker' && <input type="text" placeholder="New User ID" value={newUser} onChange={e => setNewUser(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />}
        {targetType === 'broker' && <input type="text" placeholder="New Broker ID" value={newBroker} onChange={e => setNewBroker(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px' }} />}

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button className="template-btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }} onClick={onClose}>Cancel</button>
          <button className="template-btn" style={{ flex: 1, borderColor: 'var(--ms-gold)' }} onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Moving...' : 'Confirm Move'}</button>
        </div>
      </div>
    </div>
  );
}
