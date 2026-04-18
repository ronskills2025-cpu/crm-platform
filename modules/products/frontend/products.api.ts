import api from '../../../packages/utils/src/http';

// ── Automation Products: Funnel API ─────────────────────────────
export const funnelApi = {
  captureLead: (data: Record<string, unknown>) => api.post('/funnel/leads', data).then((r) => r.data),
  listLeads: (params?: Record<string, string | number>) => api.get('/funnel/leads', { params }).then((r) => r.data),
  getLead: (id: string) => api.get(`/funnel/leads/${id}`).then((r) => r.data),
  updateLead: (id: string, data: Record<string, unknown>) => api.patch(`/funnel/leads/${id}`, data).then((r) => r.data),
  recordClick: (id: string) => api.post(`/funnel/leads/${id}/click`).then((r) => r.data),
  recordReply: (id: string) => api.post(`/funnel/leads/${id}/reply`).then((r) => r.data),
  listSteps: (productId: string) => api.get(`/funnel/products/${productId}/steps`).then((r) => r.data),
  upsertStep: (productId: string, data: Record<string, unknown>) => api.put(`/funnel/products/${productId}/steps`, data).then((r) => r.data),
  deleteStep: (stepId: string) => api.delete(`/funnel/steps/${stepId}`).then((r) => r.data),
  getStats: () => api.get('/funnel/stats').then((r) => r.data),
};

// ── Automation Products: Appointment API ────────────────────────
export const appointmentApi = {
  createService: (data: Record<string, unknown>) => api.post('/appointments/services', data).then((r) => r.data),
  listServices: () => api.get('/appointments/services').then((r) => r.data),
  updateService: (id: string, data: Record<string, unknown>) => api.patch(`/appointments/services/${id}`, data).then((r) => r.data),
  deleteService: (id: string) => api.delete(`/appointments/services/${id}`).then((r) => r.data),
  upsertSlot: (data: Record<string, unknown>) => api.put('/appointments/slots', data).then((r) => r.data),
  listSlots: (serviceId: string) => api.get(`/appointments/services/${serviceId}/slots`).then((r) => r.data),
  getAvailable: (serviceId: string, date: string) => api.get(`/appointments/services/${serviceId}/available`, { params: { date } }).then((r) => r.data),
  deleteSlot: (slotId: string) => api.delete(`/appointments/slots/${slotId}`).then((r) => r.data),
  createBooking: (data: Record<string, unknown>) => api.post('/appointments/bookings', data).then((r) => r.data),
  listBookings: (params?: Record<string, string>) => api.get('/appointments/bookings', { params }).then((r) => r.data),
  getBooking: (id: string) => api.get(`/appointments/bookings/${id}`).then((r) => r.data),
  updateBookingStatus: (id: string, status: string) => api.patch(`/appointments/bookings/${id}/status`, { status }).then((r) => r.data),
  reschedule: (id: string, data: Record<string, unknown>) => api.patch(`/appointments/bookings/${id}/reschedule`, data).then((r) => r.data),
  cancelBooking: (id: string) => api.post(`/appointments/bookings/${id}/cancel`).then((r) => r.data),
  getStats: () => api.get('/appointments/stats').then((r) => r.data),
};

// ── Automation Products: Payment Bot API ────────────────────────
export const paymentBotApi = {
  create: (data: Record<string, unknown>) => api.post('/payment-bot', data).then((r) => r.data),
  list: (params?: Record<string, string>) => api.get('/payment-bot', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/payment-bot/${id}`).then((r) => r.data),
  recordPayment: (id: string, data: Record<string, unknown>) => api.post(`/payment-bot/${id}/payment`, data).then((r) => r.data),
  escalate: (id: string) => api.post(`/payment-bot/${id}/escalate`).then((r) => r.data),
  getStats: () => api.get('/payment-bot/stats').then((r) => r.data),
};

// ── Automation Products: Review API ─────────────────────────────
export const reviewApi = {
  create: (data: Record<string, unknown>) => api.post('/reviews', data).then((r) => r.data),
  list: (params?: Record<string, string>) => api.get('/reviews', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/reviews/${id}`).then((r) => r.data),
  submitRating: (id: string, data: Record<string, unknown>) => api.post(`/reviews/${id}/rate`, data).then((r) => r.data),
  getStats: () => api.get('/reviews/stats').then((r) => r.data),
};

// ── Automation Products: Event Reminder API ─────────────────────
export const eventApi = {
  create: (data: Record<string, unknown>) => api.post('/events', data).then((r) => r.data),
  list: (params?: Record<string, string>) => api.get('/events', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/events/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/events/${id}`, data).then((r) => r.data),
  deleteEvent: (id: string) => api.delete(`/events/${id}`).then((r) => r.data),
  register: (eventId: string, data: Record<string, unknown>) => api.post(`/events/${eventId}/registrations`, data).then((r) => r.data),
  listRegistrations: (eventId: string, params?: Record<string, string>) => api.get(`/events/${eventId}/registrations`, { params }).then((r) => r.data),
  updateRegistrationStatus: (eventId: string, regId: string, status: string) => api.patch(`/events/${eventId}/registrations/${regId}/status`, { status }).then((r) => r.data),
  getStats: () => api.get('/events/stats').then((r) => r.data),
};

// ── Automation Products: Catalog + Order API ────────────────────
export const catalogApi = {
  createProduct: (data: Record<string, unknown>) => api.post('/catalog/products', data).then((r) => r.data),
  listProducts: (params?: Record<string, string>) => api.get('/catalog/products', { params }).then((r) => r.data),
  getProduct: (id: string) => api.get(`/catalog/products/${id}`).then((r) => r.data),
  updateProduct: (id: string, data: Record<string, unknown>) => api.patch(`/catalog/products/${id}`, data).then((r) => r.data),
  deleteProduct: (id: string) => api.delete(`/catalog/products/${id}`).then((r) => r.data),
  createOrder: (data: Record<string, unknown>) => api.post('/catalog/orders', data).then((r) => r.data),
  listOrders: (params?: Record<string, string>) => api.get('/catalog/orders', { params }).then((r) => r.data),
  getOrder: (id: string) => api.get(`/catalog/orders/${id}`).then((r) => r.data),
  updateOrderStatus: (id: string, status: string) => api.patch(`/catalog/orders/${id}/status`, { status }).then((r) => r.data),
  recordPayment: (id: string, paymentStatus: string) => api.post(`/catalog/orders/${id}/payment`, { paymentStatus }).then((r) => r.data),
  getStats: () => api.get('/catalog/stats').then((r) => r.data),
};

// ── Automation Products: Survey API ─────────────────────────────
export const surveyApi = {
  create: (data: Record<string, unknown>) => api.post('/surveys', data).then((r) => r.data),
  list: (params?: Record<string, string>) => api.get('/surveys', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/surveys/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/surveys/${id}`, data).then((r) => r.data),
  deleteSurvey: (id: string) => api.delete(`/surveys/${id}`).then((r) => r.data),
  upsertQuestion: (surveyId: string, data: Record<string, unknown>) => api.put(`/surveys/${surveyId}/questions`, data).then((r) => r.data),
  listQuestions: (surveyId: string) => api.get(`/surveys/${surveyId}/questions`).then((r) => r.data),
  deleteQuestion: (surveyId: string, questionId: string) => api.delete(`/surveys/${surveyId}/questions/${questionId}`).then((r) => r.data),
  startResponse: (surveyId: string, data: Record<string, unknown>) => api.post(`/surveys/${surveyId}/responses`, data).then((r) => r.data),
  listResponses: (surveyId: string, params?: Record<string, string>) => api.get(`/surveys/${surveyId}/responses`, { params }).then((r) => r.data),
  submitAnswer: (responseId: string, data: Record<string, unknown>) => api.post(`/surveys/responses/${responseId}/answer`, data).then((r) => r.data),
  completeResponse: (responseId: string, data?: Record<string, unknown>) => api.post(`/surveys/responses/${responseId}/complete`, data ?? {}).then((r) => r.data),
  getStats: () => api.get('/surveys/stats').then((r) => r.data),
};

// ── Automation Products: Membership API ─────────────────────────
export const membershipApi = {
  create: (data: Record<string, unknown>) => api.post('/memberships', data).then((r) => r.data),
  list: (params?: Record<string, string>) => api.get('/memberships', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/memberships/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/memberships/${id}`, data).then((r) => r.data),
  deleteMembership: (id: string) => api.delete(`/memberships/${id}`).then((r) => r.data),
  renew: (id: string, data: Record<string, unknown>) => api.post(`/memberships/${id}/renew`, data).then((r) => r.data),
  recordPayment: (id: string, paymentStatus: string) => api.post(`/memberships/${id}/payment`, { paymentStatus }).then((r) => r.data),
  getStats: () => api.get('/memberships/stats').then((r) => r.data),
};

// ── Automation Products: Dashboard API ──────────────────────────
export const productDashboardApi = {
  register: (data: Record<string, unknown>) => api.post('/products', data).then((r) => r.data),
  list: () => api.get('/products').then((r) => r.data),
  toggle: (id: string) => api.patch(`/products/${id}/toggle`).then((r) => r.data),
  deleteProduct: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
  setConfig: (id: string, key: string, value: unknown) => api.put(`/products/${id}/config`, { key, value }).then((r) => r.data),
  getConfig: (id: string) => api.get(`/products/${id}/config`).then((r) => r.data),
  listEvents: (params?: Record<string, string>) => api.get('/products/events', { params }).then((r) => r.data),
  listNotifications: (params?: Record<string, string>) => api.get('/products/notifications', { params }).then((r) => r.data),
  markNotificationsRead: (ids: string[]) => api.post('/products/notifications/read', { ids }).then((r) => r.data),
  getDashboardStats: () => api.get('/products/dashboard/stats').then((r) => r.data),
};
