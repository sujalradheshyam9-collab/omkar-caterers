import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebaseConfig';
import { collection, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Owner sirf password enter karta hai — ye email background mein fixed hai, kabhi UI mein nahi dikhta.
// Firebase Console mein isी email se ek Authentication user banana hoga.
const OWNER_EMAIL = 'owner@omkar-caterers.app';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export default function OmkarOwner() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentPage, setCurrentPage] = useState('ownerLogin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(() => parseInt(localStorage.getItem('omkar_owner_failed_attempts') || '0'));
  const [lockedUntil, setLockedUntil] = useState(() => parseInt(localStorage.getItem('omkar_owner_locked_until') || '0'));
  const [editingBillId, setEditingBillId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'cancel'|'delete', billId, message }
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [newDishText, setNewDishText] = useState('');
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [billDraft, setBillDraft] = useState({ pricePerGuest: '0', gstPercent: '0', guestCount: '0' });
  const [billingFilter, setBillingFilter] = useState('all'); // 'all' | 'pending' | 'paid'
  const [dateSearchInput, setDateSearchInput] = useState('');
  const knownBookingIds = useRef(new Set());
  const isFirstSnapshot = useRef(true);

  useEffect(() => {
    const b = bookings.find(x => x.id === editingBillId);
    if (b) setBillDraft({ pricePerGuest: String(b.pricePerGuest ?? 0), gstPercent: String(b.gstPercent ?? 0), guestCount: String(b.guestCount ?? 0), eventDate: b.eventDate ?? '', eventTime: b.eventTime ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBillId]);

  const playNotifySound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) { /* audio not available */ }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const liveBookings = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

      if (!isFirstSnapshot.current) {
        const newPending = liveBookings.filter(b => b.status === 'pending' && !knownBookingIds.current.has(b.id));
        if (newPending.length > 0) {
          playNotifySound();
          if ('Notification' in window && Notification.permission === 'granted') {
            newPending.forEach(b => {
              new Notification('🔔 नया Order आया!', { body: `${b.customerName} — ${b.eventDate} | ${b.guestCount} guests` });
            });
          }
        }
      } else {
        isFirstSnapshot.current = false;
      }
      knownBookingIds.current = new Set(liveBookings.map(b => b.id));
      setBookings(liveBookings);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setCurrentPage(user ? 'ownerDashboard' : 'ownerLogin');
      setAuthChecked(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

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
    try {
      await signInWithEmailAndPassword(auth, OWNER_EMAIL, password);
      setPassword('');
      setFailedAttempts(0);
      setLockedUntil(0);
      setLoginError('');
    } catch (err) {
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

  const runConfirmedAction = async () => {
    if (!confirmModal) return;
    const { type, billId } = confirmModal;
    if (type === 'cancel') {
      const reason = cancelReasonInput.trim() || 'कोई कारण नहीं बताया गया';
      setBookings(prev => prev.map(b => b.id === billId ? { ...b, status: 'cancelled', cancelReason: reason } : b));
      setConfirmModal(null);
      setCancelReasonInput('');
      setCurrentPage('ownerDashboard');
      await updateDoc(doc(db, 'bookings', billId), { status: 'cancelled', cancelReason: reason });
    } else if (type === 'delete') {
      setBookings(prev => prev.filter(b => b.id !== billId));
      setConfirmModal(null);
      setCurrentPage('ownerDashboard');
      await deleteDoc(doc(db, 'bookings', billId));
    }
  };

  const markPaymentStatus = async (billId, status) => {
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, paymentStatus: status } : b));
    await updateDoc(doc(db, 'bookings', billId), { paymentStatus: status });
  };

  const updateBillField = async (billId, field, value) => {
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, [field]: value } : b));
    await updateDoc(doc(db, 'bookings', billId), { [field]: value });
  };

  const addDishToBill = async (billId) => {
    if (!newDishText.trim()) return;
    const bill = bookings.find(b => b.id === billId);
    if (!bill) return;
    const updatedDishes = [...bill.allDishes, newDishText.trim()];
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, allDishes: updatedDishes } : b));
    setNewDishText('');
    await updateDoc(doc(db, 'bookings', billId), { allDishes: updatedDishes });
  };

  const removeDishFromBill = async (billId, index) => {
    const bill = bookings.find(b => b.id === billId);
    if (!bill) return;
    const updatedDishes = bill.allDishes.filter((_, i) => i !== index);
    setBookings(prev => prev.map(b => b.id === billId ? { ...b, allDishes: updatedDishes } : b));
    await updateDoc(doc(db, 'bookings', billId), { allDishes: updatedDishes });
  };

  const renderConfirmModal = () => {
    if (!confirmModal) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <p className="text-lg font-bold mb-4 text-center">{confirmModal.message}</p>
          {confirmModal.type === 'cancel' && (
            <div className="mb-4">
              <label className="text-xs font-bold">Cancel करने की वजह (customer को दिखेगी):</label>
              <textarea value={cancelReasonInput} onChange={(e) => setCancelReasonInput(e.target.value)} placeholder="जैसे: Date पर पहले से booking है" className="w-full border-2 border-gray-300 rounded p-2 text-sm mt-1" rows={2} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setConfirmModal(null); setCancelReasonInput(''); }} className="bg-gray-300 text-gray-800 font-bold py-3 rounded-lg">रहने दो</button>
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

  if (!authChecked) {
    return <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center"><p className="text-white font-bold text-lg">⏳ Loading...</p></div>;
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
        {renderConfirmModal()}
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
        {renderConfirmModal()}
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
              <input type="number" value={billDraft.pricePerGuest} onChange={(e) => setBillDraft(prev => ({ ...prev, pricePerGuest: e.target.value }))} onBlur={() => updateBillField(bill.id, 'pricePerGuest', parseInt(billDraft.pricePerGuest) || 0)} className="w-full border-2 border-yellow-300 rounded p-2 text-lg font-bold mt-1" />
            </div>
            <div className="bg-white p-2 rounded text-xs">
              <p><strong>Subtotal:</strong> ₹{((parseInt(billDraft.pricePerGuest) || 0) * bill.guestCount).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <label className="text-xs font-bold">GST/Tax (%):</label>
              <input type="number" step="0.1" value={billDraft.gstPercent} onChange={(e) => setBillDraft(prev => ({ ...prev, gstPercent: e.target.value }))} onBlur={() => updateBillField(bill.id, 'gstPercent', parseFloat(billDraft.gstPercent) || 0)} className="w-full border-2 border-yellow-300 rounded p-2 text-lg font-bold mt-1" placeholder="जैसे 5, 12, 18" />
              <p className="text-xs text-gray-500 mt-1">GST Amount: ₹{getGstAmount({ ...bill, pricePerGuest: parseInt(billDraft.pricePerGuest) || 0, gstPercent: parseFloat(billDraft.gstPercent) || 0 }).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-green-100 p-3 rounded border-2 border-green-400">
              <p className="text-xs font-bold">TOTAL AMOUNT:</p>
              <p className="text-2xl font-bold text-green-700">₹{getTotal({ ...bill, pricePerGuest: parseInt(billDraft.pricePerGuest) || 0, gstPercent: parseFloat(billDraft.gstPercent) || 0 }).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <button onClick={() => { const p = parseInt(billDraft.pricePerGuest) || 0; if (p <= 0) { alert('Price add करो'); return; } updateBillField(bill.id, 'pricePerGuest', p); updateBillField(bill.id, 'gstPercent', parseFloat(billDraft.gstPercent) || 0); updateBillField(bill.id, 'status', 'accepted'); updateBillField(bill.id, 'paymentStatus', 'pending'); alert('✅ Bill भेज दिया customer को!'); setCurrentPage('ownerDashboard'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">✅ Send Bill to Customer</button>
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
                <input type="date" value={billDraft.eventDate ?? bill.eventDate} onChange={(e) => setBillDraft(prev => ({ ...prev, eventDate: e.target.value }))} onBlur={() => updateBillField(bill.id, 'eventDate', billDraft.eventDate ?? bill.eventDate)} className="w-full border-2 border-blue-200 rounded p-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold">Event Time:</label>
                <input type="time" value={billDraft.eventTime ?? bill.eventTime} onChange={(e) => setBillDraft(prev => ({ ...prev, eventTime: e.target.value }))} onBlur={() => updateBillField(bill.id, 'eventTime', billDraft.eventTime ?? bill.eventTime)} className="w-full border-2 border-blue-200 rounded p-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold">Guest Count:</label>
                <input type="number" min={bill.orderType === 'parcel' ? 25 : 50} value={billDraft.guestCount} onChange={(e) => setBillDraft(prev => ({ ...prev, guestCount: e.target.value }))} onBlur={() => updateBillField(bill.id, 'guestCount', parseInt(billDraft.guestCount) || 0)} className="w-full border-2 border-blue-200 rounded p-2 text-sm mt-1" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => updateBillField(bill.id, 'mealType', 'lunch')} className={`flex-1 py-2 rounded font-bold text-xs ${bill.mealType === 'lunch' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>🍽️ Lunch</button>
                <button onClick={() => updateBillField(bill.id, 'mealType', 'dinner')} className={`flex-1 py-2 rounded font-bold text-xs ${bill.mealType === 'dinner' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>🍴 Dinner</button>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400 mb-4">
            <p className="text-xs font-bold text-yellow-700 mb-2">🍽️ MENU ITEMS ({bill.allDishes.length})</p>
            <div className="bg-white rounded p-2 mb-2 max-h-40 overflow-y-auto border border-yellow-200">
              {bill.allDishes.map((dish, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                  <span><strong>{i+1}.</strong> {dish.replace('Own: ', '')}</span>
                  <button onClick={() => removeDishFromBill(bill.id, i)} className="text-red-600 font-bold px-2">❌</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="नई dish जोड़ो..." value={newDishText} onChange={(e) => setNewDishText(e.target.value)} className="flex-1 border-2 border-yellow-300 rounded p-2 text-sm" />
              <button onClick={() => addDishToBill(bill.id)} className="bg-yellow-600 text-white font-bold px-4 rounded text-sm">+ Add</button>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300 mb-4">
            <p className="text-xs font-bold text-green-700 mb-2">💰 PRICE & GST</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold">Price per Guest:</label>
                <input type="number" value={billDraft.pricePerGuest} onChange={(e) => setBillDraft(prev => ({ ...prev, pricePerGuest: e.target.value }))} onBlur={() => updateBillField(bill.id, 'pricePerGuest', parseInt(billDraft.pricePerGuest) || 0)} className="w-full border-2 border-green-300 rounded p-2 text-lg font-bold mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold">GST/Tax (%):</label>
                <input type="number" step="0.1" value={billDraft.gstPercent} onChange={(e) => setBillDraft(prev => ({ ...prev, gstPercent: e.target.value }))} onBlur={() => updateBillField(bill.id, 'gstPercent', parseFloat(billDraft.gstPercent) || 0)} className="w-full border-2 border-green-300 rounded p-2 text-lg font-bold mt-1" placeholder="जैसे 5, 12, 18" />
                <p className="text-xs text-gray-500 mt-1">GST Amount: ₹{getGstAmount({ ...bill, pricePerGuest: parseInt(billDraft.pricePerGuest) || 0, gstPercent: parseFloat(billDraft.gstPercent) || 0, guestCount: parseInt(billDraft.guestCount) || bill.guestCount }).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-3 rounded border-2 border-green-400">
                <p className="text-xs font-bold">TOTAL AMOUNT:</p>
                <p className="text-2xl font-bold text-green-700">₹{getTotal({ ...bill, pricePerGuest: parseInt(billDraft.pricePerGuest) || 0, gstPercent: parseFloat(billDraft.gstPercent) || 0, guestCount: parseInt(billDraft.guestCount) || bill.guestCount }).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          <button onClick={() => { updateBillField(bill.id, 'pricePerGuest', parseInt(billDraft.pricePerGuest) || 0); updateBillField(bill.id, 'gstPercent', parseFloat(billDraft.gstPercent) || 0); updateBillField(bill.id, 'guestCount', parseInt(billDraft.guestCount) || bill.guestCount); alert('✅ Bill update हो गया! Changes save हो गए हैं.'); setCurrentPage('ownerDashboard'); }} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">💾 Save Changes</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'viewFeedbackOwner') {
    const bill = bookings.find(b => b.id === editingBillId);
    if (!bill || !bill.feedback) return null;
    const { catering, staff, food, server, text } = bill.feedback;
    const StarDisplay = ({ rating }) => <div className="flex gap-1">{[1,2,3,4,5].map(i => <span key={i} className={`text-lg ${i <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>)}</div>;
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-4">
          <button onClick={() => setCurrentPage('ownerDashboard')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-4">⭐ Feedback</h1>
          <p className="text-xs font-bold text-gray-600 mb-4">{bill.customerName} | {bill.eventDate}</p>
          <div className="space-y-2 text-xs">
            <div className="bg-orange-50 p-2 rounded border-l-4 border-orange-400"><p className="font-bold text-orange-700">🎉 Catering</p><StarDisplay rating={catering} /></div>
            <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-400"><p className="font-bold text-blue-700">👥 Staff</p><StarDisplay rating={staff} /></div>
            <div className="bg-green-50 p-2 rounded border-l-4 border-green-400"><p className="font-bold text-green-700">🍽️ Food</p><StarDisplay rating={food} /></div>
            <div className="bg-purple-50 p-2 rounded border-l-4 border-purple-400"><p className="font-bold text-purple-700">🚶 Service</p><StarDisplay rating={server} /></div>
            {text && <div className="bg-gray-50 p-2 rounded border-l-4 border-gray-400"><p className="font-bold text-gray-700 mb-1">✏️ Comment</p><p className="italic text-xs">"{text}"</p></div>}
          </div>
          <button onClick={() => setCurrentPage('ownerDashboard')} className="w-full bg-green-600 text-white font-bold py-2 rounded mt-4">← Back</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'dateSearch') {
    const uniquePhonesForDate = dateSearchInput ? [...new Set(bookings.filter(b => b.eventDate === dateSearchInput).map(b => b.customerPhone))] : [];
    const resultsForDate = uniquePhonesForDate.map(phone => {
      const orders = bookings.filter(b => b.customerPhone === phone && b.eventDate === dateSearchInput);
      const latest = orders[orders.length - 1];
      return { phone, name: latest.customerName, orders };
    });

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('ownerDashboard')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-4">🔍 Date से Customer खोजो</h1>
          <input type="date" value={dateSearchInput} onChange={(e) => setDateSearchInput(e.target.value)} className="w-full border-2 border-green-300 rounded-lg p-3 mb-4" />

          {dateSearchInput && resultsForDate.length === 0 && <p className="text-center text-gray-500 mt-8">📭 इस date पर कोई customer नहीं मिला</p>}

          {resultsForDate.map((r) => (
            <div key={r.phone} onClick={() => { setSelectedCustomerPhone(r.phone); setCurrentPage('customerHistory'); }} className="border-2 border-purple-200 bg-purple-50 rounded-lg p-3 mb-3 cursor-pointer hover:border-purple-400">
              <p className="font-bold">{r.name}</p>
              <p className="text-xs text-gray-600">📞 {r.phone}</p>
              <p className="text-xs text-gray-600">{r.orders.length} order(s) इस date पर</p>
              <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="inline-block bg-green-600 text-white font-bold py-1 px-3 rounded text-xs mt-2">📞 Call करो</a>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (currentPage === 'customersList') {
    const uniquePhones = [...new Set(bookings.map(b => b.customerPhone))];
    const customersSummary = uniquePhones.map(phone => {
      const orders = bookings.filter(b => b.customerPhone === phone);
      const latest = orders[orders.length - 1];
      const totalSpent = orders.filter(o => o.status === 'accepted').reduce((sum, o) => sum + getTotal(o), 0);
      return { phone, name: latest.customerName, orderCount: orders.length, totalSpent };
    }).sort((a, b) => b.orderCount - a.orderCount);

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('ownerDashboard')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">👥 All Customers ({customersSummary.length})</h1>
          {customersSummary.length > 0 ? customersSummary.map((c) => (
            <div key={c.phone} onClick={() => { setSelectedCustomerPhone(c.phone); setCurrentPage('customerHistory'); }} className="border-2 border-purple-200 bg-purple-50 rounded-lg p-3 mb-3 cursor-pointer hover:border-purple-400">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-xs text-gray-600">📞 {c.phone}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-purple-700">{c.orderCount} orders</p>
                  <p className="text-green-600 font-bold">₹{c.totalSpent.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          )) : <p className="text-center text-gray-500 mt-8">📭 अभी कोई customer नहीं</p>}
        </div>
      </div>
    );
  }

  if (currentPage === 'customerHistory') {
    const customerOrders = bookings.filter(b => b.customerPhone === selectedCustomerPhone);
    if (customerOrders.length === 0) return null;
    const customerInfo = customerOrders[customerOrders.length - 1];
    const totalSpent = customerOrders.filter(o => o.status === 'accepted').reduce((sum, o) => sum + getTotal(o), 0);

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
    const sortNewestFirst = (arr) => arr.slice().sort((a, b) => (b.createdAtTs || 0) - (a.createdAtTs || 0));
    const pendingBills = sortNewestFirst(bookings.filter(b => b.status === 'pending'));
    const sentBills = sortNewestFirst(bookings.filter(b => b.status === 'accepted'));
    const cancelledBills = sortNewestFirst(bookings.filter(b => b.status === 'cancelled'));
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        {renderConfirmModal()}
        <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-t-2xl flex justify-between items-center">
          <h1 className="text-2xl font-bold">👑 Owner</h1>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage('customersList')} className="text-sm font-bold bg-purple-700 px-3 py-1 rounded">👥 Customers</button>
            <button onClick={() => setCurrentPage('dateSearch')} className="text-sm font-bold bg-indigo-700 px-3 py-1 rounded">🔍 Date</button>
            <button onClick={() => setCurrentPage('calendarView')} className="text-sm font-bold bg-blue-700 px-3 py-1 rounded">📅 Calendar</button>
            <button onClick={() => { signOut(auth); setPassword(''); }} className="text-sm font-bold">Logout</button>
          </div>
        </div>
        <div className="bg-white rounded-b-2xl shadow-2xl flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          {pendingBills.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-bold text-orange-700 mb-3">📋 PENDING ORDERS</h2>
              {pendingBills.map((bill) => (
                <div key={bill.id} className="border-2 border-yellow-400 rounded-lg p-3 bg-yellow-50 mb-3">
                  <div className="mb-2">
                    <p className="text-xs font-bold underline cursor-pointer" onClick={() => { setSelectedCustomerPhone(bill.customerPhone); setCurrentPage('customerHistory'); }}>{bill.customerName}</p>
                    <p className="text-xs text-gray-600">{bill.eventDate} | {bill.guestCount} guests | {bill.allDishes.length} items</p>
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
              <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h2 className="text-base font-bold text-green-700">✅ BILLS SENT</h2>
                <div className="flex gap-1">
                  <button onClick={() => setBillingFilter('all')} className={`text-xs font-bold px-2 py-1 rounded ${billingFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}>All</button>
                  <button onClick={() => setBillingFilter('pending')} className={`text-xs font-bold px-2 py-1 rounded ${billingFilter === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}>⏳ Pending</button>
                  <button onClick={() => setBillingFilter('paid')} className={`text-xs font-bold px-2 py-1 rounded ${billingFilter === 'paid' ? 'bg-green-700 text-white' : 'bg-gray-200'}`}>💰 Received</button>
                </div>
              </div>

              {(billingFilter === 'all' || billingFilter === 'pending') && sentBills.filter(b => (b.paymentStatus || 'pending') === 'pending').length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-orange-700 mb-2">⏳ PAYMENT PENDING</h3>
                  {sentBills.filter(b => (b.paymentStatus || 'pending') === 'pending').map((bill) => (
                    <div key={bill.id} className="border-l-4 border-orange-400 bg-orange-50 p-3 rounded-lg mb-3">
                      <p className="font-bold text-sm mb-1 underline cursor-pointer" onClick={() => { setSelectedCustomerPhone(bill.customerPhone); setCurrentPage('customerHistory'); }}>{bill.customerName}</p>
                      <p className="text-xs text-gray-600 mb-2">{bill.eventDate} | 👥 {bill.guestCount} | 🍽️ {bill.allDishes.length} items</p>
                      <p className="text-xs font-bold text-green-600 mb-2">💰 ₹{getTotal(bill).toLocaleString('en-IN')}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewBillOwner'); }} className="bg-blue-600 text-white font-bold py-2 rounded">👁️ View</button>
                        <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('ownerEditBill'); }} className="bg-purple-600 text-white font-bold py-2 rounded">✏️ Owner Edit</button>
                      </div>
                      <button onClick={() => markPaymentStatus(bill.id, 'paid')} className="w-full bg-green-600 text-white font-bold py-2 rounded text-xs">✅ Mark Payment Received</button>
                      {bill.feedback && <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewFeedbackOwner'); }} className="text-orange-600 font-bold text-xs hover:underline mt-2 block">⭐ View Feedback</button>}
                    </div>
                  ))}
                </div>
              )}

              {(billingFilter === 'all' || billingFilter === 'paid') && sentBills.filter(b => (b.paymentStatus || 'pending') === 'paid').length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-green-700 mb-2">💰 PAYMENT RECEIVED</h3>
                  {sentBills.filter(b => (b.paymentStatus || 'pending') === 'paid').map((bill) => (
                    <div key={bill.id} className="border-l-4 border-green-500 bg-green-50 p-3 rounded-lg mb-3">
                      <p className="font-bold text-sm mb-1 underline cursor-pointer" onClick={() => { setSelectedCustomerPhone(bill.customerPhone); setCurrentPage('customerHistory'); }}>{bill.customerName}</p>
                      <p className="text-xs text-gray-600 mb-2">{bill.eventDate} | 👥 {bill.guestCount} | 🍽️ {bill.allDishes.length} items</p>
                      <p className="text-xs font-bold text-green-600 mb-2">💰 ₹{getTotal(bill).toLocaleString('en-IN')}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewBillOwner'); }} className="bg-blue-600 text-white font-bold py-2 rounded">👁️ View</button>
                        <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('ownerEditBill'); }} className="bg-purple-600 text-white font-bold py-2 rounded">✏️ Owner Edit</button>
                      </div>
                      <button onClick={() => markPaymentStatus(bill.id, 'pending')} className="w-full bg-orange-500 text-white font-bold py-2 rounded text-xs">↩️ Mark as Pending</button>
                      {bill.feedback && <button onClick={() => { setEditingBillId(bill.id); setCurrentPage('viewFeedbackOwner'); }} className="text-orange-600 font-bold text-xs hover:underline mt-2 block">⭐ View Feedback</button>}
                    </div>
                  ))}
                </div>
              )}
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
