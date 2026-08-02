import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';

export default function OmkarCustomer() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState(null);
  const [eventType, setEventType] = useState(null);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [mealType, setMealType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [foodType, setFoodType] = useState('');
  const [selectedDishes, setSelectedDishes] = useState({});
  const [customDishes, setCustomDishes] = useState({});
  const [ownMenuDishes, setOwnMenuDishes] = useState({});
  const [editingBillId, setEditingBillId] = useState(null);
  const [cateringRating, setCateringRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [serverRating, setServerRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [guestOrderIds, setGuestOrderIds] = useState(() => JSON.parse(sessionStorage.getItem('omkar_guest_order_ids') || '[]'));

  const menuStructure = {
    'Welcome Drinks': ['Masala Chai', 'Lassi', 'Sweet Lassi', 'Fresh Juice', 'Masala Shikanji', 'Nimbu Pani'],
    'Maharashtrian': ['Aalu Chivda', 'Bhakri', 'Misal Pav', 'Pithla', 'Puran Poli', 'Chikhalwali'],
    'Gujarati': ['Dhokla', 'Fafda', 'Khichiyu', 'Fairu', 'Thepla', 'Undhiyu'],
    'Rajasthani': ['Bajra Roti', 'Moong Dal Pakora', 'Ker Sangri', 'Gatte ka Saag', 'Pitla'],
    'Sindhi': ['Sindhi Biryani', 'Tarkari', 'Sindhi Puri', 'Chikhalwali', 'Papads'],
    'Punjabi': ['Chole Bhature', 'Sarson da Saag', 'Paneer Kulcha', 'Aloo Paratha', 'Amritsari Kulche'],
    'Chaat': ['Pani Puri', 'Bhel Puri', 'Dahi Bhalle', 'Sev Tameta', 'Gol Gappe', 'Masala Puri'],
    'South Indian': ['Idli', 'Dosa', 'Uttapam', 'Sambhar', 'Rasam', 'Pongal', 'Vada'],
    'Italian': ['Pasta Primavera', 'Risotto', 'Bruschetta', 'Ravioli', 'Garlic Bread'],
    'Mexican': ['Nachos', 'Quesadilla', 'Burrito', 'Tacos', 'Guacamole'],
    'Chinese': ['Chow Mein', 'Fried Rice', 'Hakka Noodles', 'Spring Roll', 'Manchurian']
  };

  useEffect(() => {
    const saved = localStorage.getItem('omkar_logged_in_customer');
    if (saved) {
      const customer = JSON.parse(saved);
      setCustomerName(customer.name);
      setCustomerEmail(customer.email);
      setCustomerPhone(customer.phone);
      setCustomerAddress(customer.address);
      setIsLoggedIn(true);
      setCurrentPage('mainMenu');
    }
  }, []);

  // Firestore se real-time me bookings aur customers sync hote hain.
  // Jaise hi koi bhi device (customer ya owner) data change kare, sabko turant update mil jaayega.
  useEffect(() => {
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });
    return () => { unsubBookings(); unsubCustomers(); };
  }, []);

  useEffect(() => { sessionStorage.setItem('omkar_guest_order_ids', JSON.stringify(guestOrderIds)); }, [guestOrderIds]);

  const getSavedCustomerByPhone = (phone) => customers.find(c => c.phone === phone);

  const handleLogin = (name, email, phone, address) => {
    setCustomerName(name);
    setCustomerEmail(email);
    setCustomerPhone(phone);
    setCustomerAddress(address);
    setIsLoggedIn(true);
    localStorage.setItem('omkar_logged_in_customer', JSON.stringify({ name, email, phone, address }));
    setCurrentPage('mainMenu');
  };

  const handleLogout = () => {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerAddress('');
    setIsLoggedIn(false);
    localStorage.removeItem('omkar_logged_in_customer');
    setCurrentPage('home');
  };

  if (currentPage === 'home') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="text-6xl mb-4">🍛</div>
          <h1 className="text-3xl font-bold text-green-600 mb-2">Omkar Caterers</h1>
          <p className="text-gray-600 mb-8">✓ 100% PURE VEGETARIAN</p>
          <div className="space-y-4">
            <button onClick={() => setCurrentPage('customerEntry')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">👤 Login</button>
            <button onClick={() => setCurrentPage('orderType')} className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg">🚀 Guest</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'customerEntry') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <button onClick={() => setCurrentPage('home')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">📞 Phone</h1>
          <input type="tel" placeholder="10 digits" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength="10" className="w-full border-2 border-green-300 rounded-lg p-3 mb-4" />
          <button onClick={() => { if (customerPhone.length === 10) { const saved = getSavedCustomerByPhone(customerPhone); if (saved) handleLogin(saved.name, saved.email, saved.phone, saved.address); else setCurrentPage('newCustomer'); } else alert('10-digit number दालो'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">Check →</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'newCustomer') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <button onClick={() => setCurrentPage('customerEntry')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">📝 Details</h1>
          <div className="space-y-3 mb-6">
            <input type="text" placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border-2 border-green-300 rounded-lg p-3" />
            <input type="email" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full border-2 border-green-300 rounded-lg p-3" />
            <textarea placeholder="Address (min 15)" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows="3" className="w-full border-2 border-green-300 rounded-lg p-3" />
            <button onClick={() => { if (customerName && customerEmail && customerAddress.length >= 15) { addDoc(collection(db, 'customers'), { name: customerName, email: customerEmail, phone: customerPhone, address: customerAddress }); handleLogin(customerName, customerEmail, customerPhone, customerAddress); } else alert('सब भरो'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'mainMenu') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-3xl font-bold text-green-600 mb-2">Welcome to Omkar Caterers!</h1>
          <div className="bg-green-50 p-4 rounded-lg mb-6 text-left">
            <p><strong>Name:</strong> {customerName}</p>
            <p><strong>Phone:</strong> {customerPhone}</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => setCurrentPage('orderType')} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">New Order →</button>
            <button onClick={() => setCurrentPage('myOrders')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">My Orders</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'orderType') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <button onClick={() => setCurrentPage(isLoggedIn ? 'mainMenu' : 'home')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">📦 Order Type</h1>
          <div className="space-y-4">
            <button onClick={() => { setOrderType('party'); setCurrentPage('eventSelection'); }} className="w-full bg-purple-600 text-white font-bold py-4 rounded-lg text-lg">🎉 PARTY</button>
            <button onClick={() => { setOrderType('parcel'); setCurrentPage('eventSelection'); }} className="w-full bg-orange-600 text-white font-bold py-4 rounded-lg text-lg">📦 PARCEL</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'myOrders') {
    const myOrders = customerPhone
      ? bookings.filter(b => b.customerPhone === customerPhone)
      : bookings.filter(b => guestOrderIds.includes(b.id));
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('mainMenu')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">📋 My Orders</h1>
          {myOrders.length > 0 ? (
            <div className="space-y-4">
              {myOrders.map((order) => (
                <div key={order.id} className={`border-2 rounded-lg p-4 ${order.status === 'accepted' ? 'bg-green-50 border-green-500' : order.status === 'cancelled' ? 'bg-gray-100 border-gray-400' : 'bg-red-50 border-red-500'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-bold">ORDER #{order.billId}</p>
                    <span className={`text-2xl ${order.status === 'accepted' ? 'text-green-600' : order.status === 'cancelled' ? 'text-gray-500' : 'text-red-600'}`}>{order.status === 'accepted' ? '✅' : order.status === 'cancelled' ? '🚫' : '⏳'}</span>
                  </div>
                  <p className="text-sm">📦 {order.orderType?.toUpperCase() || 'PARTY'} | 📅 {order.eventDate} | 👥 {order.guestCount}</p>
                  <p className="text-sm"><strong>Status:</strong> {order.status === 'accepted' ? '✅ CONFIRMED' : order.status === 'cancelled' ? '🚫 CANCELLED by Owner' : '⏳ PENDING'}</p>
                  {order.status === 'accepted' && <p className="text-sm"><strong>💰 ₹{((order.pricePerGuest * order.guestCount) + ((order.pricePerGuest * order.guestCount) * ((order.gstPercent || 0) / 100))).toLocaleString('en-IN')}</strong> (incl. GST {order.gstPercent || 0}%)</p>}
                  <div className="flex gap-2 mt-2 items-center flex-wrap">
                    <button onClick={() => { setEditingBillId(order.id); setCurrentPage('viewOrderCustomer'); }} className="bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm">👁️ View</button>
                    {order.status === 'accepted' && !order.feedback && <button onClick={() => { setCurrentPage('giveFeedback'); setEditingBillId(order.id); }} className="bg-green-600 text-white font-semibold py-1 px-3 rounded text-xs">⭐ Feedback</button>}
                  </div>
                  {order.feedback && <div className="mt-2 bg-yellow-50 p-2 rounded text-sm border-l-4 border-yellow-400"><p className="font-bold">✓ Feedback दिया</p></div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">📭 कोई order नहीं</p>
          )}
        </div>
      </div>
    );
  }

  if (currentPage === 'viewOrderCustomer') {
    const order = bookings.find(b => b.id === editingBillId);
    if (!order) return null;
    const subtotal = order.pricePerGuest * order.guestCount;

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('myOrders')} className="mb-4 text-green-600 font-semibold">← Back</button>

          <div className="text-center mb-4 border-b-2 border-green-300 pb-3">
            <h1 className="text-2xl font-bold text-green-600">🍛 ORDER</h1>
            <p className="text-xl font-bold text-green-600">{order.billId}</p>
            <h2 className="text-lg font-bold text-green-700">OMKAR CATERERS</h2>
            <p className="text-xs text-green-600">✓ 100% PURE VEGETARIAN</p>
            {order.status === 'cancelled' && <p className="text-red-600 font-bold mt-2">🚫 CANCELLED by Owner</p>}
            {order.status === 'pending' && <p className="text-yellow-600 font-bold mt-2">⏳ PENDING (owner से wait है)</p>}
            {order.status === 'accepted' && <p className="text-green-600 font-bold mt-2">✅ CONFIRMED</p>}
          </div>

          <div className="mb-3 bg-green-50 p-3 rounded border-l-4 border-green-400 text-xs">
            <p className="font-bold text-green-700">👤 CUSTOMER</p>
            <p><strong>{order.customerName}</strong></p>
            <p>{order.customerPhone}</p>
            <p>{order.customerEmail}</p>
          </div>

          <div className="mb-3 bg-blue-50 p-3 rounded border-l-4 border-blue-400 text-xs">
            <p className="font-bold text-blue-700">🎉 EVENT</p>
            <p><strong>{order.orderType?.toUpperCase() || 'PARTY'} - {order.eventType?.toUpperCase()}</strong></p>
            <p>📅 {order.eventDate} | 🕐 {order.eventTime}</p>
            <p>👥 {order.guestCount} guests | 🍽️ {order.mealType?.toUpperCase()}</p>
            <p>🌱 {order.foodType?.toUpperCase()}</p>
          </div>

          <div className="mb-3 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
            <p className="text-xs font-bold text-yellow-700">🍽️ MENU ({order.allDishes.length} items)</p>
            <div className="bg-white rounded p-2 mt-2 max-h-40 overflow-y-auto border border-yellow-200">
              {order.allDishes.map((dish, i) => (
                <p key={i} className="text-xs py-1"><strong>{i+1}.</strong> {dish.replace('Own: ', '')}</p>              ))}
            </div>
          </div>

          {order.status === 'accepted' && (
            <div className="mb-3 bg-green-50 p-3 rounded border-l-4 border-green-400 text-xs">
              <p className="font-bold text-green-700">💰 PRICING</p>
              <p>₹{order.pricePerGuest}/guest × {order.guestCount} = ₹{subtotal.toLocaleString('en-IN')}</p>
              <p>GST ({order.gstPercent || 0}%): ₹{(subtotal * ((order.gstPercent || 0) / 100)).toLocaleString('en-IN')}</p>
              <p className="font-bold text-lg text-green-600">TOTAL: ₹{(subtotal + (subtotal * ((order.gstPercent || 0) / 100))).toLocaleString('en-IN')}</p>
            </div>
          )}

          <div className="mb-3 bg-purple-50 p-3 rounded border-l-4 border-purple-400 text-xs">
            <p className="font-bold text-purple-700 mb-2">🏠 OWNER DETAILS</p>
            <p><strong>Name:</strong> Radheshyam Maharaj</p>
            <p className="mb-2"><strong>Phone:</strong> 9763824571 / 9579385895</p>
            <div className="flex gap-2">
              <a href="tel:9763824571" className="flex-1 bg-green-600 text-white font-bold py-2 rounded text-center text-xs">📞 Call 9763824571</a>
              <a href="tel:9579385895" className="flex-1 bg-green-600 text-white font-bold py-2 rounded text-center text-xs">📞 Call 9579385895</a>
            </div>
          </div>

          <button onClick={() => setCurrentPage('myOrders')} className="w-full bg-gray-600 text-white font-bold py-2 rounded mt-2 text-sm">← Back to My Orders</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'giveFeedback') {
    const order = bookings.find(b => b.id === editingBillId);
    if (!order) return null;

    if (order.feedback) {
      const { catering, staff, food, server, text } = order.feedback;
      const StarDisplay = ({ rating }) => <div className="flex gap-1">{[1,2,3,4,5].map(i => <span key={i} className={`text-xl ${i <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>)}</div>;
      return (
        <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl my-4">
            <button onClick={() => setCurrentPage('myOrders')} className="mb-4 text-green-600 font-semibold">← Back</button>
            <h1 className="text-2xl font-bold mb-6">⭐ Your Feedback</h1>
            <div className="space-y-4">
              <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-400"><p className="text-sm font-bold text-orange-700 mb-2">🎉 Catering Service</p><StarDisplay rating={catering} /></div>
              <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400"><p className="text-sm font-bold text-blue-700 mb-2">👥 Staff Quality & Behavior</p><StarDisplay rating={staff} /></div>
              <div className="bg-green-50 p-3 rounded border-l-4 border-green-400"><p className="text-sm font-bold text-green-700 mb-2">🍽️ Food Quality</p><StarDisplay rating={food} /></div>
              <div className="bg-purple-50 p-3 rounded border-l-4 border-purple-400"><p className="text-sm font-bold text-purple-700 mb-2">🚶 Serving Staff Quality & Behavior</p><StarDisplay rating={server} /></div>
              {text && <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400"><p className="text-sm font-bold text-gray-700 mb-2">✏️ Comments</p><p className="text-sm text-gray-700">{text}</p></div>}
            </div>
            <button onClick={() => setCurrentPage('myOrders')} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg mt-4">← Back</button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl my-4">
          <button onClick={() => setCurrentPage('myOrders')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">⭐ Feedback दो</h1>
          <div className="space-y-4">
            <div>
              <p className="font-bold mb-2">🎉 Catering Service</p>
              <div className="flex gap-2">{[1,2,3,4,5].map(i => <button key={i} onClick={() => setCateringRating(i)} className={`text-2xl ${i <= cateringRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>)}</div>
            </div>
            <div>
              <p className="font-bold mb-2">👥 Staff Quality & Behavior</p>
              <div className="flex gap-2">{[1,2,3,4,5].map(i => <button key={i} onClick={() => setStaffRating(i)} className={`text-2xl ${i <= staffRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>)}</div>
            </div>
            <div>
              <p className="font-bold mb-2">🍽️ Food Quality</p>
              <div className="flex gap-2">{[1,2,3,4,5].map(i => <button key={i} onClick={() => setFoodRating(i)} className={`text-2xl ${i <= foodRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>)}</div>
            </div>
            <div>
              <p className="font-bold mb-2">🚶 Serving Staff Quality & Behavior</p>
              <div className="flex gap-2">{[1,2,3,4,5].map(i => <button key={i} onClick={() => setServerRating(i)} className={`text-2xl ${i <= serverRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>)}</div>
            </div>
            <textarea placeholder="Comment..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows="3" className="w-full border-2 border-green-300 rounded-lg p-3" />
            <button onClick={() => { const target = bookings.find(b => b.id === editingBillId); if (target?.firestoreId) { updateDoc(doc(db, 'bookings', target.firestoreId), { feedback: { catering: cateringRating, staff: staffRating, food: foodRating, server: serverRating, text: feedbackText } }); } setCateringRating(0); setStaffRating(0); setFoodRating(0); setServerRating(0); setFeedbackText(''); alert('✅ Feedback submit!'); setCurrentPage('myOrders'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">Submit ✅</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'eventSelection') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <button onClick={() => setCurrentPage('orderType')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">🎯 Event Type</h1>
          <div className="space-y-3">
            {['birthday', 'anniversary', 'marriage', 'other'].map(type => (
              <button key={type} onClick={() => { setEventType(type); setCurrentPage('eventDetails'); }} className="w-full bg-green-100 border-2 border-green-300 text-green-700 font-bold py-3 rounded-lg">
                {type === 'birthday' && '🎂 Birthday'} {type === 'anniversary' && '💍 Anniversary'} {type === 'marriage' && '💒 Marriage'} {type === 'other' && '🎉 Other'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'eventDetails') {
    const minGuests = orderType === 'parcel' ? 25 : 50;
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl my-4">
          <button onClick={() => setCurrentPage('eventSelection')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">📅 Details</h1>
          <div className="space-y-4">
            <div>
              <input type="number" min={minGuests} placeholder={`Guests (कम से कम ${minGuests})`} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className="w-full border-2 border-green-300 rounded-lg p-3" />
              <p className="text-xs text-gray-500 mt-1">📌 {orderType === 'parcel' ? 'Parcel' : 'Party'} के लिए minimum {minGuests} guests होने चाहिए</p>
            </div>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full border-2 border-green-300 rounded-lg p-3" />
            <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full border-2 border-green-300 rounded-lg p-3" />
            <div className="flex gap-3">
              <button onClick={() => setMealType('lunch')} className={`flex-1 py-2 rounded-lg font-bold ${mealType === 'lunch' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>🍽️ Lunch</button>
              <button onClick={() => setMealType('dinner')} className={`flex-1 py-2 rounded-lg font-bold ${mealType === 'dinner' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>🍴 Dinner</button>
            </div>
            <button onClick={() => { if (!guestCount || !eventDate || !eventTime || !mealType) { alert('सब भरो'); return; } if (parseInt(guestCount) < minGuests) { alert(`${orderType === 'parcel' ? 'Parcel' : 'Party'} के लिए कम से कम ${minGuests} guests होने चाहिए`); return; } setCurrentPage('foodPreferences'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">Next →</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'foodPreferences') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <button onClick={() => setCurrentPage('eventDetails')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">🍽️ Food Type</h1>
          <div className="space-y-3">
            {[{ id: 'jain', label: '🌱 Full Jain' }, { id: 'nonOnionGarlic', label: '🧄 No Onion-Garlic' }, { id: 'spicy', label: '🌶️ Spicy' }, { id: 'medium', label: '👌 Medium' }].map(opt => (
              <button key={opt.id} onClick={() => setFoodType(opt.id)} className={`w-full py-3 rounded-lg font-bold border-2 ${foodType === opt.id ? 'bg-green-600 text-white' : 'border-green-300'}`}>{opt.label}</button>
            ))}
          </div>
          <button onClick={() => { if (!foodType) alert('Select करो'); else setCurrentPage('menuSelect'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg mt-4">Next →</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'menuSelect') {
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('foodPreferences')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-6">🍽️ Menu</h1>
          <button onClick={() => setCurrentPage('createOwnMenu')} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg mb-3">✨ Create Your Own</button>
          <button
            onClick={() => {
              const packageItems = [
                { category: 'main', text: 'Paneer Sabzi' },
                { category: 'main', text: 'Mix Veg' },
                { category: 'main', text: 'Dal' },
                { category: 'main', text: 'Chawal (Rice)' },
                { category: 'starter', text: 'Starter 1' },
                { category: 'starter', text: 'Starter 2' },
                { category: 'dessert', text: 'Meetha (Sweet)' },
              ];
              const obj = {};
              packageItems.forEach((item, i) => {
                obj[Date.now() + i] = item;
              });
              setOwnMenuDishes(obj);
              setCurrentPage('createOwnMenu');
            }}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg mb-6"
          >
            📦 Normal Package लो (2 Sabzi + Dal-Chawal + 2 Starter + Meetha)
          </button>
          {Object.entries(menuStructure).map(([category, items]) => (
            <div key={category} className="mb-6 border-2 border-green-300 rounded-lg p-4 bg-green-50">
              <h2 className="font-bold text-lg text-green-700 mb-3">{category}</h2>
              <div className="space-y-2 mb-4">{items.map(dish => (
                <label key={dish} className="flex items-center cursor-pointer"><input type="checkbox" checked={selectedDishes[dish] || false} onChange={(e) => setSelectedDishes({...selectedDishes, [dish]: e.target.checked})} className="mr-3 w-4 h-4" /><span className="text-sm">{dish}</span></label>
              ))}</div>
              <div className="bg-white rounded-lg border-2 border-yellow-400 p-3"><p className="text-xs font-bold text-yellow-700 mb-2">📝 अगर पसंद नहीं:</p><textarea placeholder="अपनी dish..." value={customDishes[category] || ''} onChange={(e) => setCustomDishes({...customDishes, [category]: e.target.value})} rows="2" className="w-full border-2 border-yellow-300 rounded-lg p-2 text-sm resize-none" /></div>
            </div>
          ))}
          <button onClick={() => { if (Object.values(selectedDishes).every(v => !v) && Object.values(customDishes).every(v => !v)) alert('Select करो'); else setCurrentPage('billGeneration'); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">Bill बनाओ →</button>
        </div>
      </div>
    );
  }

  if (currentPage === 'createOwnMenu') {
    const courseCategories = [
      { id: 'welcome', label: '🥤 Welcome Drink', example: 'जैसे: Masala Chai, Lassi, Fresh Juice, Nimbu Pani' },
      { id: 'starter', label: '🥗 Starter / Snacks', example: 'जैसे: Pakora, Dhokla, Chaat, Bhel Puri' },
      { id: 'main', label: '🍛 Main Course (Dal / Sabzi / Rice / Roti / Sides)', example: 'जैसे: Dal Fry, Paneer Sabzi, Mix Veg, Roti, Naan, Jeera Rice, Pulao, Salad, Raita, Papad' },
      { id: 'dessert', label: '🍮 Dessert / Sweet', example: 'जैसे: Gulab Jamun, Kheer, Halwa', suggestions: ['Mung Dal Halwa', 'Dahi Wada', 'Shahi Tukda', 'Gulab Jamun', 'Kala Jamun'] },
    ];

    const dishesByCategory = (catId) => Object.entries(ownMenuDishes).filter(([_, d]) => d.category === catId);

    const addDishToCategory = (catId) => {
      const newId = Date.now() + Math.random();
      setOwnMenuDishes({ ...ownMenuDishes, [newId]: { category: catId, text: '' } });
    };

    const addSuggestedDish = (catId, text) => {
      const alreadyAdded = Object.values(ownMenuDishes).some(d => d.category === catId && d.text.trim() === text);
      if (alreadyAdded) return;
      const newId = Date.now() + Math.random();
      setOwnMenuDishes({ ...ownMenuDishes, [newId]: { category: catId, text } });
    };

    const updateDishText = (id, text) => {
      setOwnMenuDishes({ ...ownMenuDishes, [id]: { ...ownMenuDishes[id], text } });
    };

    const removeDish = (id) => {
      const updated = { ...ownMenuDishes };
      delete updated[id];
      setOwnMenuDishes(updated);
    };

    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col p-4">
        <div className="bg-white rounded-2xl shadow-2xl flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <button onClick={() => setCurrentPage('menuSelect')} className="mb-4 text-green-600 font-semibold">← Back</button>
          <h1 className="text-2xl font-bold mb-3">✨ Create Menu</h1>

          <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3 mb-6 text-xs">
            <p className="font-bold text-blue-700 mb-1">🍽️ आम तौर पर order ऐसे चलता है:</p>
            <p className="text-blue-700">Welcome Drink → Starter → Main Course → Bread/Rice → Dessert</p>
            <p className="text-gray-600 mt-1">कोई भी category आपको नहीं चाहिए तो उसे खाली छोड़कर सीधे अगली category पर जा सकते हो — कुछ भी ज़रूरी नहीं है।</p>
          </div>

          {courseCategories.map((cat) => (
            <div key={cat.id} className="mb-5 border-2 border-green-200 rounded-lg p-3 bg-green-50">
              <p className="font-bold text-green-700 text-sm">{cat.label}</p>
              <p className="text-xs text-gray-500 mb-2">{cat.example}</p>

              {cat.suggestions && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-orange-700 mb-1">✨ हमारी Signature Sweets (tap करके add करो):</p>
                  <div className="flex flex-wrap gap-2">
                    {cat.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => addSuggestedDish(cat.id, s)}
                        className="bg-orange-100 border border-orange-400 text-orange-800 text-xs font-semibold px-3 py-1 rounded-full"
                      >
                        + {s}
                      </button>
                    ))}                  </div>
                </div>
              )}

              <div className="space-y-2 mb-2">
                {dishesByCategory(cat.id).map(([id, dish]) => (
                  <div key={id} className="flex gap-2">
                    <input
                      type="text"
                      value={dish.text}
                      onChange={(e) => updateDishText(id, e.target.value)}
                      placeholder="Dish का नाम लिखो..."
                      className="flex-1 border-2 border-green-300 rounded-lg p-2 text-sm"
                    />
                    <button onClick={() => removeDish(id)} className="bg-red-600 text-white font-bold px-3 rounded-lg text-sm">❌</button>
                  </div>
                ))}
              </div>

              <button onClick={() => addDishToCategory(cat.id)} className="w-full bg-white border-2 border-green-400 text-green-700 font-semibold py-2 rounded-lg text-sm">
                + {cat.label} जोड़ो
              </button>
            </div>
          ))}

          <button
            onClick={() => {
              const filled = Object.values(ownMenuDishes).filter(d => d.text && d.text.trim());
              if (filled.length === 0) { alert('कम से कम 1 dish add करो किसी भी category में'); return; }
              const catLabelMap = Object.fromEntries(courseCategories.map(c => [c.id, c.label.replace(/^[^\s]+\s/, '')]));
              setSelectedDishes({});
              setCustomDishes({});
              filled.forEach((d) => {
                const label = catLabelMap[d.category] || 'Other';
                setSelectedDishes(prev => ({ ...prev, [`${label}: ${d.text.trim()}`]: true }));
              });
              setCurrentPage('billGeneration');
            }}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg mt-2"
          >
            Bill बनाओ →
          </button>
        </div>
      </div>
    );
  }

  if (currentPage === 'billGeneration') {
    const guests = parseInt(guestCount) || 1;
    const selectedList = Object.entries(selectedDishes).filter(([_, s]) => s).map(([d]) => d);
    const customList = Object.entries(customDishes).filter(([_, v]) => v).map(([cat, dish]) => `${cat}: ${dish}`);
    const allDishes = [...selectedList, ...customList];
    const billId = `#OMKAR${bookings.filter(b => b.customerPhone === customerPhone).length + 1}`;
    return (
      <div className="h-screen bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-4">
          <div className="text-center mb-4 border-b-2 border-green-300 pb-3">
            <h1 className="text-2xl font-bold text-green-600">🍛 BILL</h1>
            <p className="text-xl font-bold text-green-600 mb-1">{billId}</p>
            <h2 className="text-lg font-bold text-green-700">OMKAR CATERERS</h2>
            <p className="text-xs text-green-600">✓ 100% PURE VEGETARIAN</p>
          </div>
          <div className="mb-3 bg-green-50 p-3 rounded border-l-4 border-green-400">
            <p className="text-xs font-bold text-green-700">👤 CUSTOMER</p>
            <p className="text-xs"><strong>Name:</strong> {customerName || 'Guest'}</p>
            <p className="text-xs"><strong>Phone:</strong> {customerPhone || '-'}</p>
          </div>
          <div className="mb-3 bg-blue-50 p-3 rounded border-l-4 border-blue-400">
            <p className="text-xs font-bold text-blue-700">🎉 EVENT</p>
            <p className="text-xs"><strong>Type:</strong> {orderType?.toUpperCase() || 'PARTY'} - {eventType?.toUpperCase()}</p>
            <p className="text-xs"><strong>Date:</strong> {eventDate} | <strong>Time:</strong> {eventTime}</p>
            <p className="text-xs"><strong>Guests:</strong> {guests} | <strong>Meal:</strong> {mealType?.toUpperCase()}</p>
          </div>
          <div className="mb-3 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
            <p className="text-xs font-bold text-yellow-700">🍽️ MENU ({allDishes.length} items)</p>
            <div className="bg-white rounded p-2 mt-1 max-h-32 overflow-y-auto">{allDishes.map((dish, i) => <p key={i} className="text-xs"><strong>{i+1}</strong> {dish}</p>)}</div>
          </div>
          <div className="mb-3 bg-purple-50 p-3 rounded border-l-4 border-purple-400">
            <p className="text-xs font-bold text-purple-700 mb-2">🏠 OWNER DETAILS</p>
            <p className="text-xs"><strong>Name:</strong> Radheshyam Maharaj</p>
            <p className="text-xs mb-2"><strong>Phone:</strong> 9763824571 / 9579385895</p>
            <div className="flex gap-2">
              <a href="tel:9763824571" className="flex-1 bg-green-600 text-white font-bold py-2 rounded text-center text-xs">📞 Call Now</a>
            </div>
          </div>
          <div className="mb-4 bg-red-50 p-3 rounded border-l-4 border-red-400"><p className="text-xs font-bold text-red-700">⏳ STATUS</p><p className="text-xs text-red-600">PENDING (Owner से price & confirmation का wait है)</p></div>
          <button onClick={() => { const newId = Math.random().toString(36).substr(2, 9); const bill = { id: newId, billId, customerName: customerName || 'Guest', customerEmail, customerPhone, customerAddress, orderType, eventType, eventDate, eventTime, mealType, guestCount: guests, foodType, allDishes, pricePerGuest: 0, gstPercent: 0, totalAmount: 0, status: 'pending', createdAt: new Date().toLocaleString() }; addDoc(collection(db, 'bookings'), bill); if (!customerPhone) { setGuestOrderIds(prev => [...prev, newId]); } alert('✅ Order Request भेज दिया! Owner से price का wait करें।'); setCurrentPage('myOrders'); setEventType(null); setEventDate(''); setEventTime(''); setMealType(''); setGuestCount(''); setFoodType(''); setSelectedDishes({}); setCustomDishes({}); setOwnMenuDishes({}); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg mb-2">✅ Send Request</button>
          <button onClick={() => setCurrentPage('menuSelect')} className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg text-sm">← Back</button>
        </div>
      </div>
    );
  }

  return null;
            }
