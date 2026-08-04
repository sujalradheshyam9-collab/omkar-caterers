import React, { useState, useEffect } from 'react';

// Password ka plain text kahin nahi store hota — SHA-256 hash yahan hai.
// Login ke waqt entered password ko hash karke isse compare kiya jaata hai.
const OWNER_PASSWORD_HASH = 'd0318ce6ad9c9278e143f6c6aa0770ec989bd0fb1989c99c305130dd59cd152c';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function OmkarOwner() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('omkar_owner_logged_in') === 'true');
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem('omkar_owner_logged_in') === 'true' ? 'ownerDashboard' : 'ownerLogin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(() => parseInt(localStorage.getItem('omkar_owner_failed_attempts') || '0'));
  const [lockedUntil, setLockedUntil] = useState(() => parseInt(localStorage.getItem('omkar_owner_locked_until') || '0'));
  const [editingBillId, setEditingBillId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState(() => JSON.parse(localStorage.getItem('omkar_bookings') || '[]'));
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'cancel'|'delete', billId, message }
  const [newDishText, setNewDishText] = useState('');
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);

  useEffect(() => { localStorage.setItem('omkar_bookings', JSON.stringify(bookings)); }, [bookings]);
  useEffect(() => { localStorage.setItem('omkar_owner_logged_in', isLoggedIn ? 'true' : 'false'); }, [isLoggedIn]);
  useEffect(() => { localStorage.setItem('omkar_owner_failed_attempts', String(failedAttempts)); }, [failedAttempts]);
  useEffect(() => { localStorage.setItem('omkar_owner_locked_until', String(lockedUntil)); }, [lockedUntil]);

  const isLocked = () => Date.now() < lockedUntil;

  const getLockRemainingText = () => {
    const remainingMs = lockedUntil - Date.now();
    if (remainingMs <= 0) return '';
    const mins = Math.ceil(remainingMs / 60000);
    return `${mins} मिनट`;
  };

  const attemptLogin = async () => {
    if (isLocked()) {
      setLoginError(`बहुत सारी गलत कोशिशें हुईं। कृपया ${getLockRemainingText()} बाद फिर try करें।`);
      return;
    }
    const enteredHash = await sha256Hex(password);
    if (enteredHash === OWNER_PASSWORD_HASH) {
      setIsLoggedIn(true);
      setCurrentPage('ownerDashboard');
      setPassword('');
      setFailedAttempts(0);
      setLockedUntil(0);
      setLoginError('');
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPassword('');
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(until);
        setLoginError(`❌ 5 बार गलत password डाला गया। सुरक्षा के लिए 15 मिनट के लिए लॉक कर दिया गया है।`);
      } else {
        setLoginError(`❌ गलत password। ${MAX_LOGIN_ATTEMPTS - newAttempts} कोशिशें बाकी हैं।`);
      }
    }
  };

  const getSubtotal = (b) => b.pricePerGuest * b.guestCount;
  const getGstAmount = (b) => getSubtotal(b) * ((b.gstPercent || 0) / 100);
  const getTotal = (b) => getSubtotal(b) + getGstAmount(b);

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const formatDateLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getEventsForDate = (date) => {
    const dateStr = formatDateLocal(date);
    return bookings.filter(b => b.eventDate === dateStr);
  };

  const askCancelBill = (billId) => {
    setConfirmModal({ type: 'cancel', billId, message: 'क्या आप वाकई इस bill को cancel करना चाहते हैं?' });
  };

  const askDeleteBill = (billId) => {
    setConfirmModal({ type: 'delete', billId, message: 'क्या आप इस bill को permanently delete करना चाहते हैं? यह वापस नहीं आएगा.' });
  };

  const runConfirmedAction = () => {
    if (!confirmModal) return;
    const { type, billId } = confirmModal;
    if (type === 'cancel') {
      setBookings(prev => prev.map(b => b.id === billId ? { ...b, status: 'cancelled' } : b));
      setConfirmModal(null);
      setCurrentPage('ownerDashboard');
    } else if (type === 'delete') {
      setBookings(prev => prev.filter(b => b.id !== billId));
      setConfirmModal(null);
      setCurrentPage('ownerDashboard');
    }
  };

  const updateBillField = (billId, field, value) => {
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, [field]: value } : b));
  };

  const addDishToBill = (billId) => {
    if (!newDishText.trim()) return;
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, allDishes: [...b.allDishes, newDishText.trim()] } : b));
    setNewDishText('');
  };

  const removeDishFromBill = (billId, index) => {
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, allDishes: b.allDishes.filter((_, i) => i !== index) } : b));
  };

  const ConfirmModal = () => {
    if (!confirmModal) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <p className="text-lg font-bold mb-6 text-center">{confirmModal.message}</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setConfirmModal(null)} className="bg-gray-300 text-gray-800 font-bold py-3 rounded-lg">रहने दो</button>
            <button onClick={runConfirmedAction} className="bg-red-600 text-white font-bold py-3 rounded-lg">हाँ, करो</button>
          </div>
        </div>
      </div>
    );
  };

  if (currentPage === 'dayEvents') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('calendarView')} className="mb-4 text-green-600 font-semibold">← Back to Calendar</button>
          <h1 className="text-2xl font-bold mb-2">📅 {selectedDayEvents[0]?.eventDate}</h1>
          <p className="text-sm text-gray-600 mb-4">इस दिन {selectedDayEvents.length} bookings हैं</p>
          {selectedDayEvents.map((ev) => (
            <div key={ev.id} onClick={() => { setEditingBillId(ev.id); setCurrentPage('viewBillOwner'); }} className={`border-l-4 rounded-lg p-3 mb-3 cursor-pointer ${ev.status === 'accepted' ? 'bg-green-50 border-green-500' : ev.status === 'cancelled' ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-500'}`}>
              <div className="flex justify-between items-center">
                <div className="text-xs">
                  <p className="font-bold">{ev.customerName} — {ev.eventType?.toUpperCase()}</p>
                  <p className="text-gray-600">🕐 {ev.eventTime} | 👥 {ev.guestCount} | 🍽️ {ev.allDishes.length} items</p>
                </div>
                <span className="text-sm font-bold">{ev.status === 'accepted' ? '✅' : ev.status === 'cancelled' ? '🚫' : '⏳'}</span>
              </div>
              {ev.status === 'accepted' && <p className="text-xs font-bold text-green-600 mt-1">₹{getTotal(ev).toLocaleString('en-IN')}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (currentPage === 'ownerLogin') {
    const locked = isLocked();
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🍛</div>
            <h1 className="text-3xl font-bold text-green-600 mb-2">Omkar Caterers</h1>
            <p className="text-gray-600">Owner Dashboard</p>
          </div>
          <h1 className="text-2xl font-bold text-center mb-6">👑 Owner Login</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            disabled={locked}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter' && !locked) attemptLogin(); }}
            className="w-full border-2 border-green-300 rounded-lg p-3 mb-4 disabled:bg-gray-100"
          />
          {loginError && <p className="text-red-600 text-sm font-semibold mb-4 text-center">{loginError}</p>}
          <button
            onClick={attemptLogin}
            disabled={locked}
            className={`w-full font-bold py-3 rounded-lg text-white ${locked ? 'bg-gray-400' : 'bg-green-600'}`}
          >
            {locked ? `🔒 Locked (${getLockRemainingText()} बाद try करें)` : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  if (currentPage === 'calendarView') {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <ConfirmModal />
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          <button onClick={() => setCurrentPage('ownerDashboard')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">📅 Calendar - Events</h1>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="bg-blue-600 text-white px-3 py-1 rounded font-bold">←</button>
              <p className="font-bold text-lg min-w-48 text-center">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</p>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="bg-blue-600 text-white px-3 py-1 rounded font-bold">→</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-6">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="font-bold text-center bg-green-100 p-2 rounded">{day}</div>)}
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="aspect-square"></div>;
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const events = getEventsForDate(date);
              const event = events[0];
              const clickable = events.length > 0;
              return (
                <div
                  key={day}
                  onClick={() => {
                    if (!clickable) return;
                    if (events.length === 1) { setEditingBillId(event.id); setCurrentPage('viewBillOwner'); }
                    else { setSelectedDayEvents(events); setCurrentPage('dayEvents'); }
                  }}
                  className={`aspect-square p-2 rounded-lg border-2 flex flex-col justify-start text-xs ${clickable ? 'cursor-pointer hover:opacity-80' : ''} ${event ? event.status === 'accepted' ? 'bg-green-100 border-green-500' : event.status === 'cancelled' ? 'bg-red-100 border-red-400' : 'bg-yellow-100 border-yellow-500' : 'bg-gray-50 border-gray-200'}`}
                >
                  <p className="font-bold text-sm">{day}</p>
                  {event && (
                    <div className="overflow-hidden mt-1">
                      <p className="font-bold text-xs truncate">{event.customerName}</p>
                      <p className="text-xs truncate">{event.eventType?.toUpperCase()}</p>
                      <p className={`text-xs font-bold ${event.status === 'accepted' ? 'text-green-600' : event.status === 'cancelled' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {event.status === 'accepted' ? '✅' : event.status === 'cancelled' ? '❌' : '⏳'}
                      </p>
                      {event.status === 'accepted' && <p className="text-xs text-gray-600">₹{getTotal(event).toLocaleString('en-IN')}</p>}
                      {events.length > 1 && <p className="text-xs font-bold text-purple-700">+{events.length - 1} more</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t-2 pt-4">
            <h2 className="font-bold mb-3">📋 Legend:</h2>
            <div className="space-y-2">
              <div className="flex gap-2 items-center"><div className="w-6 h-6 bg-green-100 border-2 border-green-500 rounded"></div><span>✅ Confirmed — tap to view</span></div>
              <div className="flex gap-2 items-center"><div className="w-6 h-6 bg-yellow-100 border-2 border-yellow-500 rounded"></div><span>⏳ Pending — tap to view</span></div>
              <div className="flex gap-2 items-center"><div className="w-6 h-6 bg-red-100 border-2 border-red-400 rounded"></div><span>❌ Cancelled — tap to view</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'viewBillOwner') {
    const bill = bookings.find(b => b.id === editingBillId);
    if (!bill) return null;
    const subtotal = bill.pricePerGuest * bill.guestCount;

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <ConfirmModal />
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('ownerDashboard')} className="mb-4 text-green-600 font-semibold">← Back</button>

          <div className="text-center mb-4 border-b-2 border-green-300 pb-3">
            <h1 className="text-2xl font-bold text-green-600">🍛 BILL</h1>
            <p className="text-xl font-bold text-green-600">{bill.billId}</p>
            <h2 className="text-lg font-bold text-green-700">OMKAR CATERERS</h2>
            <p className="text-xs text-green-600">✓ 100% PURE VEGETARIAN</p>
            {bill.status === 'cancelled' && <p className="text-red-600 font-bold mt-2">❌ CANCELLED</p>}
          </div>

          <div className="mb-3 bg-green-50 p-3 rounded border-l-4 border-green-400 text-xs">
            <p className="font-bold text-green-700">👤 CUSTOMER</p>
            <p><strong>{bill.customerName}</strong></p>
            <p>{bill.customerPhone}</p>
            <p>{bill.customerEmail}</p>
            <p>{bill.customerAddress}</p>
            <a href={`tel:${bill.customerPhone}`} className="inline-block bg-green-600 text-white font-bold py-1 px-3 rounded text-xs mt-2">📞 Call Customer</a>
          </div>

          <div className="mb-3 bg-blue-50 p-3 rounded border-l-4 border-blue-400 text-xs">
            <p className="font-bold text-blue-700">🎉 EVENT</p>
            <p><strong>{bill.orderType?.toUpperCase() || 'PARTY'} - {bill.eventType?.toUpperCase()}</strong></p>
            <p>📅 {bill.eventDate} | 🕐 {bill.eventTime}</p>
            <p>👥 {bill.guestCount} guests | 🍽️ {bill.mealType?.toUpperCase()}</p>
            <p>🌱 {bill.foodType?.toUpperCase()}</p>
          </div>

          <div className="mb-3 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
            <p className="text-xs font-bold text-yellow-700">🍽️ MENU ({bill.allDishes.length} items)</p>
            <div className="bg-white rounded p-2 mt-2 max-h-40 overflow-y-auto border border-yellow-200">
              {bill.allDishes.map((dish, i) => (
                <p key={i} className="text-xs py-1"><strong>{i+1}.</strong> {dish.replace('Own: ', '')}</p>
              ))}
            </div>
          </div>

          {bill.pricePerGuest > 0 && (
            <div className="mb-3 bg-green-50 p-3 rounded border-l-4 border-green-400 text-xs">
              <p className="font-bold text-green-700">💰 PRICING</p>
              <p>₹{bill.pricePerGuest}/guest × {bill.guestCount} = ₹{subtotal.toLocaleString('en-IN')}</p>
              <p>GST ({bill.gstPercent || 0}%): ₹{getGstAmount(bill).toLocaleString('en-IN')}</p>
              <p className="font-bold text-lg text-green-600">TOTAL: ₹{getTotal(bill).toLocaleString('en-IN')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            {bill.status === 'pending' && (
              <button onClick={() => { setCurrentPage('editBill'); }} className="bg-green-600 text-white font-bold py-2 rounded text-sm">📝 Create Bill</button>
            )}
            {bill.status === 'accepted' && (
              <button onClick={() => { setCurrentPage('ownerEditBill'); }} className="bg-blue-600 text-white font-bold py-2 rounded text-sm">✏️ Owner Edit</button>
            )}
            {bill.status === 'pending' && (
              <button onClick={() => askCancelBill(bill.id)} className="bg-orange-600 text-white font-bold py-2 rounded text-sm">🚫 Cancel Bill</button>
            )}
            <button onClick={() => askDeleteBill(bill.id)} className="bg-red-600 text-white font-bold py-2 rounded text-sm col-span-2">🗑️ Delete Permanently</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'editBill') {
    const bill = bookings.find(b => b.id === editingBillId);
    if (!bill) return null;

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('viewBillOwner')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-4">📝 Create Bill</h1>
          <p className="text-sm font-bold text-gray-700 mb-4">{bill.customerName} | {bill.eventDate} | {bill.guestCount} guests | {bill.allDishes.length} items</p>

          <h3 className="font-bold mb-2 text-sm">🍽️ MENU:</h3>
          <div className="bg-yellow-50 rounded p-3 border-2 border-yellow-200 mb-4 max-h-32 overflow-y-auto text-xs">
            {bill.allDishes.map((dish, i) => (
              <p key={i}><strong>{i+1}.</strong> {dish.replace('Own: ', '')}</p>
            ))}
          </div>

          <h3 className="font-bold mb-3 text-sm">💰 PRICE & GST (तू enter कर):</h3>
          <div className="space-y-3 mb-4 bg-yellow-50 p-4 rounded border-2 border-yellow-300">
            <div>
              <label className="text-xs font-bold">Price per Guest:</label>
              <input type="number" value={bill.pricePerGuest} onChange={(e) => updateBillField(bill.id, 'pricePerGuest', parseInt(e.target.value) || 0)} className="w-full border-2 border-yellow-300 rounded p-2 text-lg font-bold mt-1" />
            </div>
            <div className="bg-white p-2 rounded text-xs">
              <p><strong>Subtotal:</strong> ₹{(bill.pricePerGuest * bill.guestCount).toLocaleString('en-IN')}</p>
            </div>
               
              <label className="text-xs font-bold">GST/Tax (%):</label>
              <input type="number" step="0.1" value={bill.gstPercent || 0} onChange={(e) => updateBillField(bill.id, 'gstPercent', parseFloat(e.target.value) || 0)} className="w-full border-2 border-yellow-300 rounded p-2 text-lg font-bold mt-1" placeholder="जैसे 5, 12, 18" />
              <p className="text-xs text-gray-500 mt-1">GST Amount: ₹{getGstAmount(bill).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-green-100 p-3 rounded border-2 border-green-400">
              <p className="text-xs font-bold">TOTAL AMOUNT:</p>
              <p className="text-2xl font-bold text-green-700">₹{getTotal(bill).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <button onClick={() => { if (bill.pricePerGuest <= 0) { alert('Price add करो'); return; } updateBillField(bill.id, 'status', 'accepted'); alert('✅ Bill भेज दिया customer को!'); setCurrentPage('ownerDashboard'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">✅ Send Bill to Customer</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'ownerEditBill') {
    const bill = bookings.find(b => b.id === editingBillId);
    if (!bill) return null;

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('viewBillOwner')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-2">✏️ Owner Edit</h1>
          <p className="text-xs text-gray-500 mb-4">📞 अगर customer ने phone पर कुछ बदलने को बोला है, यहाँ से edit करो — customer को दोबारा request करने की जरूरत नहीं.</p>

          <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400 mb-4">
            <p className="text-xs font-bold text-blue-700 mb-2">🎉 EVENT DETAILS</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold">Event Date:</label>
                <input type="date" value={bill.eventDate} onChange={(e) => updateBillField(bill.id, 'eventDate', e.target.value)} className="w-full border-2 border-blue-200 rounded p-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold">Event Time:</label>
                <input type="time" value={bill.eventTime} onChange={(e) => updateBillField(bill.id, 'eventTime', e.target.value)} className="w-full border-2 border-blue-200 rounded p-2 text-sm mt-1" />
              </div>
                return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('ownerDashboard')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-2">📇 Customer History</h1>
          <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-400 mb-4 text-sm">
            <p><strong>Name:</strong> {customerInfo.customerName}</p>
            <p><strong>Phone:</strong> {customerInfo.customerPhone}</p>
            <p><strong>Email:</strong> {customerInfo.customerEmail}</p>
            <p><strong>Address:</strong> {customerInfo.customerAddress}</p>
            <a href={`tel:${customerInfo.customerPhone}`} className="inline-block bg-green-600 text-white font-bold py-1 px-3 rounded text-xs mt-2">📞 Call Customer</a>
            <p className="mt-2"><strong>Total Orders:</strong> {customerOrders.length} | <strong>Total Spent:</strong> <span className="text-green-600 font-bold">₹{totalSpent.toLocaleString('en-IN')}</span></p>
          </div>

          <h2 className="font-bold mb-3 text-sm">📋 सभी Orders:</h2>
          {customerOrders.map((order) => (
            <div key={order.id} onClick={() => { setEditingBillId(order.id); setCurrentPage('viewBillOwner'); }} className={`border-l-4 rounded-lg p-3 mb-3 cursor-pointer ${order.status === 'accepted' ? 'bg-green-50 border-green-500' : order.status === 'cancelled' ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-500'}`}>
              <div className="flex justify-between items-center">
                <div className="text-xs">
                  <p className="font-bold">{order.billId} — {order.eventType?.toUpperCase()}</p>
                  <p className="text-gray-600">{order.eventDate} | 👥 {order.guestCount} | 🍽️ {order.allDishes.length} items</p>
                </div>
                <span className="text-xs font-bold">
                  {order.status === 'accepted' ? '✅' : order.status === 'cancelled' ? '🚫' : '⏳'}
                </span>
              </div>
              {order.status === 'accepted' && <p className="text-xs font-bold text-green-600 mt-1">₹{getTotal(order).toLocaleString('en-IN')}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (currentPage === 'ownerDashboard') {
    const pendingBills = bookings.filter(b => b.status === 'pending');
    const sentBills = bookings.filter(b => b.status === 'accepted');
    const cancelledBills = bookings.filter(b => b.status === 'cancelled');
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <ConfirmModal />
        <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-t-2xl flex justify-between items-center">
          <h1 className="text-2xl font-bold">👑 Owner</h1>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage('customersList')} className="text-sm font-bold bg-purple-700 px-3 py-1 rounded">👥 Customers</button>
            <button onClick={() => setCurrentPage('calendarView')} className="text-sm font-bold bg-blue-700 px-3 py-1 rounded">📅 Calendar</button>
            <button onClick={() => { setIsLoggedIn(false); setCurrentPage('ownerLogin'); setPassword(''); }} className="text-sm font-bold">Logout</button>
          </div>
        </div>
        <div className="bg-white rounded-b-2xl shadow-2xl flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          {pendingBills.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-bold text-orange-700 mb-3">📋 PENDING ORDERS</h2>
              {pendingBills.map((bill) => (
                <div key={bill.id} className="border-2 border-yellow-400 rounded-lg p-3 bg-yellow-50 mb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs">
                      <p className="font-bold underline cursor-pointer" onClick={() => { setSelectedCustomerPhone(bill.customerPhone); setCurrentPage('customerHistory'); }}>{bill.customerName}</p>
                      <p className="text-gray-600">{bill.eventDate} | {bill.guestCount} guests | {bill.allDishes.length} items</p>
                    </div>
                    <span className="bg-yellow-300 text-yellow-800 px-2 py-1 rounded text-xs font-bold">⏳</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewBillOwner'); }} className="bg-blue-600 text-white font-bold py-2 rounded text-xs">👁️ View</button>
                    <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('editBill'); }} className="bg-green-600 text-white font-bold py-2 rounded text-xs">📝 Create Bill</button>
                    <button onClick={() => askCancelBill(bill.id)} className="bg-orange-600 text-white font-bold py-2 rounded text-xs">🚫 Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {sentBills.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-bold text-green-700 mb-3">✅ BILLS SENT</h2>
              {sentBills.map((bill) => (
                <div key={bill.id} className="border-l-4 border-green-500 bg-green-50 p-3 rounded-lg mb-3">
                  <p className="font-bold text-sm mb-1 underline cursor-pointer" onClick={() => { setSelectedCustomerPhone(bill.customerPhone); setCurrentPage('customerHistory'); }}>{bill.customerName}</p>
                  <p className="text-xs text-gray-600 mb-2">{bill.eventDate} | 👥 {bill.guestCount} | 🍽️ {bill.allDishes.length} items</p>
                  <p className="text-xs font-bold text-green-600 mb-2">💰 ₹{getTotal(bill).toLocaleString('en-IN')}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewBillOwner'); }} className="bg-blue-600 text-white font-bold py-2 rounded">👁️ View</button>
                    <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('ownerEditBill'); }} className="bg-purple-600 text-white font-bold py-2 rounded">✏️ Owner Edit</button>
                  </div>
                  {bill.feedback && <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewFeedbackOwner'); }} className="text-orange-600 font-bold text-xs hover:underline mt-2 block">⭐ View Feedback</button>}
                </div>
              ))}
            </div>
          )}
          {cancelledBills.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-red-700 mb-3">❌ CANCELLED</h2>
              {cancelledBills.map((bill) => (
                <div key={bill.id} className="border-l-4 border-red-400 bg-red-50 p-3 rounded-lg mb-3">
                  <p className="font-bold text-sm mb-1">{bill.customerName}</p>
                  <p className="text-xs text-gray-600 mb-2">{bill.eventDate} | 👥 {bill.guestCount}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewBillOwner'); }} className="bg-blue-600 text-white font-bold py-2 rounded">👁️ View</button>
                    <button onClick={() => askDeleteBill(bill.id)} className="bg-red-600 text-white font-bold py-2 rounded">🗑️ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {bookings.length === 0 && <p className="text-center text-gray-500 mt-8">📭 No orders</p>}
        </div>
      </div>
    );
  }

  return null;
                    }
