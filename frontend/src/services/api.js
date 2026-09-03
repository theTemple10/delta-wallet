import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

export const seedUsers = () => api.post('/users/seed');
export const getChannels = (userId) => api.get(`/channels/${userId}`);
export const simulateInflow = (userId, amount, currency = 'USDB') =>
  api.post('/inflow', { user_id: userId, amount, currency });
export const proposeSplit = (inflowEventId, mode, splits = null) =>
  api.post(`/inflow/${inflowEventId}/propose-split`, { mode, splits });
export const createProposal = (channelId, data) =>
  api.post(`/channels/${channelId}/proposal`, data);
export const approveProposal = (proposalId) =>
  api.post(`/proposals/${proposalId}/approve`);
export const getSignPayload = (proposalId) =>
  api.get(`/proposals/${proposalId}/sign-payload`);
export const signProposal = (proposalId) =>
  api.post(`/proposals/${proposalId}/sign`);
export const getProposal = (proposalId) =>
  api.get(`/proposals/${proposalId}`);
export const getDigest = (inflowEventId, mode = 'ai') =>
  api.get(`/digest/${inflowEventId}?mode=${mode}`);
export const issueCard = (userId, data) =>
  api.post('/cards', { user_id: userId, ...data });
export const setCardLimit = (cardId, dailyLimit, singleTxnLimit) =>
  api.put(`/cards/${cardId}/limit`, { daily_limit: dailyLimit, single_txn_limit: singleTxnLimit });

export default api;
