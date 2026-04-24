import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// --- Auth ---
export const loginAPI = (data) => API.post('/auth/login', data);
export const registerAPI = (data) => API.post('/auth/register', data);

// --- Shop ---
export const getMyShop = () => API.get('/shop/mine');
export const createShop = (data) => API.post('/shop', data);
export const updateShopTables = (shopId, tables) => API.put(`/shop/${shopId}/tables`, { tables });
export const getShopById = (shopId) => API.get(`/shop/${shopId}`);
export const getTableQR = (shopId, tableNumber) => API.get(`/shop/${shopId}/qr/${tableNumber}`);
export const updateTableStatus = (shopId, tableNumber, status) =>
    API.put(`/shop/${shopId}/table/${tableNumber}/status`, { status });

// --- Products ---
export const getProducts = (shopId) => API.get(`/product/shop/${shopId}`);
export const addProduct = (data) => API.post('/product', data);
export const updateProduct = (id, data) => API.put(`/product/${id}`, data);
export const deleteProduct = (id) => API.delete(`/product/${id}`);

// --- Tokens ---
export const generateToken = (shopId, tableNumber) =>
    API.post('/token/generate', { shopId, tableNumber });
export const joinSession = (shopId, tableNumber, username, people) =>
    API.post('/token/join', { shopId, tableNumber, username, people });
export const rejoinSession = (shopId, tableNumber, guestCode, username) =>
    API.post('/token/rejoin', { shopId, tableNumber, guestCode, username });
export const validateToken = (pin, shopId, username) =>
    API.post('/token/validate', { pin, shopId, username });
export const getActiveToken = (shopId, tableNumber) =>
    API.get(`/token/active/${shopId}/${tableNumber}`);
export const closeToken = (tokenId) => API.put(`/token/close/${tokenId}`);
export const leaveSession = (tokenId, username) => API.put(`/token/leave/${tokenId}/${username}`);
export const confirmSeat = (pin, shopId, username) =>
    API.post('/token/validate', { pin, shopId, username });

// --- Orders ---
export const placeOrder = (data) => API.post('/order', data);
export const verifyOrder = (orderId) => API.put(`/order/${orderId}/verify`);
export const rejectOrder = (orderId) => API.put(`/order/${orderId}/reject`);
export const getShopOrders = (shopId) => API.get(`/order/shop/${shopId}/active`);
export const getAllShopOrders = (shopId) => API.get(`/order/shop/${shopId}/all`);
export const updateItemStatus = (orderId, itemId, status) =>
    API.put(`/order/${orderId}/item/${itemId}`, { status });
export const markOrderPaid = (orderId, method) =>
    API.put(`/order/${orderId}/pay`, { method });

// Called on tab close — cancels pending items for this user so kitchen is clean
export const cancelUserItems = (sessionTokenId, username) =>
    API.put('/order/cancel-user-items', { sessionTokenId, username });

// --- Admin ---
export const getAdminStats = () => API.get('/admin/stats');
export const getAdminShops = () => API.get('/admin/shops');
export const toggleShop = (shopId) => API.put(`/admin/shop/${shopId}/toggle`);

// --- Offers ---
export const getOffers = (shopId) => API.get(`/shop/${shopId}/offers`);
export const getAllOffers = (shopId) => API.get(`/shop/${shopId}/offers/all`);
export const addOffer = (shopId, data) => API.post(`/shop/${shopId}/offers`, data);
export const updateOffer = (shopId, offerId, data) => API.put(`/shop/${shopId}/offers/${offerId}`, data);
export const deleteOffer = (shopId, offerId) => API.delete(`/shop/${shopId}/offers/${offerId}`);
export const updateUPI = (shopId, upiId) => API.put(`/shop/${shopId}/upi`, { upiId });

export default API;
